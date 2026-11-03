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
    if (!groqApiKey) return res.status(200).json({ reply: 'GROQ_API_KEY missing in Vercel settings.' });

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
        console.error("Supabase issue:", e);
      }
    }

    const systemPrompt = `You are HelpPilot AI, a customer support assistant. Answer concisely based ONLY on this context:\n\n=== KNOWLEDGE BASE ===\n${knowledgeContext}\n======================\n\nQuestion: "${message}"`;

    // 2. Direct single call to Groq standard model
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      })
    });

    const data = await groqRes.json();

    if (data.error) {
      // Fallback try with mixtral if model ID fails
      const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        })
      });
      const fallbackData = await fallbackRes.json();
      const fbText = fallbackData.choices?.[0]?.message?.content;
      return res.status(200).
