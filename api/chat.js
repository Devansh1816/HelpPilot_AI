export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { appId, message } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!message) return res.status(400).json({ error: 'Message is required' });

    if (!geminiApiKey) {
      return res.status(200).json({ reply: 'GEMINI_API_KEY environment variable is missing in Vercel.' });
    }

    const cleanKey = geminiApiKey.trim();

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
          if (docs && docs.length > 0) {
            knowledgeContext = docs.map(d => `Title: ${d.title}\nContent: ${d.content}`).join("\n\n");
          }
        }
      } catch (e) {
        console.error("Supabase fetch error:", e);
      }
    }

    const systemPrompt = `You are HelpPilot AI, a customer support assistant. Answer the user's question concisely based ONLY on this context:\n\n=== KNOWLEDGE BASE ===\n${knowledgeContext}\n======================\n\nQuestion: "${message}"`;

    // 2. DYNAMIC AUTO-DISCOVERY: Fetch active models list directly from Google API
    const listModelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    const listData = await listModelsRes.json();

    if (listData.error) {
      return res.status(200).json({ reply: `Google Key Error [${listData.error.code}]: ${listData.error.message}` });
    }

    const availableModels = listData.models || [];

    // Filter models that support generateContent method
    const validModels = availableModels.filter(m => 
      m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
    );

    if (validModels.length === 0) {
      return res.status(200).json({ reply: 'No active text generation models found for your Google API Key.' });
    }

    // Auto-select best matching model (Prefer flash model, fallback to first valid model)
    const targetModel = validModels.find(m => m.name.includes('flash')) || validModels[0];
    const modelEndpointName = targetModel.name; // Formatted as "models/gemini-..."

    // 3. Generate Content using the Auto-Discovered Active Model
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelEndpointName}:generateContent?key=${cleanKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      }
    );

    const aiData = await geminiRes.json();

    if (aiData.error) {
      return res.status(200).json({ reply: `Google API Error: ${aiData.error.message}` });
    }

    const replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: 'Empty response received from AI model.' });

  } catch (err) {
    return res.status(500).json({ error: 'Server Error: ' + err.message });
  }
}
