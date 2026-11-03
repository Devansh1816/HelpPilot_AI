export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { appId, message } = req.body || {};
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!message) return res.status(200).json({ reply: 'Message is required.' });
    if (!groqApiKey) return res.status(200).json({ reply: 'GROQ_API_KEY is missing in Vercel Environment Variables.' });

    const cleanKey = groqApiKey.trim();

    // 1. Supabase Knowledge Base Fetch
    let knowledgeContext = "No specific knowledge base uploaded yet.";
    if (supabaseUrl && supabaseKey) {
      try {
        const supaRes = await fetch(
          `${supabaseUrl}/rest/v1/knowledge_base?app_id=eq.${appId}&select=title,content`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (supaRes.ok) {
          const docs = await supaRes.json();
          if (Array.isArray(docs) && docs.length > 0) {
            knowledgeContext = docs.map(d => `Title: ${d.title}\nContent: ${d.content}`).join("\n\n");
          }
        }
      } catch (e) {
        console.error("Supabase fetch error:", e);
      }
    }

    const systemPrompt = `You are HelpPilot AI, a customer support assistant. Answer concisely based ONLY on this context:\n\n=== KNOWLEDGE BASE ===\n${knowledgeContext}\n======================\n\nQuestion: "${message}"`;

    // 2. Fetch Active Models dynamically from Groq
    let availableChatModels = [];
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${cleanKey}` }
      });
      const modelsData = await modelsRes.json();
      if (modelsData.data && Array.isArray(modelsData.data)) {
        availableChatModels = modelsData.data
          .map(m => m.id)
          .filter(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('embed'));
      }
    } catch (e) {
      console.error("Model discovery error:", e);
    }

    // Fallback list of guaranteed text models if discovery list is empty
    const candidateModels = Array.from(new Set([
      ...availableChatModels,
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ]));

    let replyText = null;
    let lastError = "";

    // 3. Try execution until a valid active text model responds
    for (const modelId of candidateModels) {
