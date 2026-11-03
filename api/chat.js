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
      return res.status(200).json({ reply: 'Vercel Env Error: GEMINI_API_KEY variable is missing.' });
    }

    // 1. Supabase Knowledge Fetch
    let knowledgeContext = "No specific knowledge base uploaded yet.";
    if (supabaseUrl && supabaseKey) {
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
    }

    const systemPrompt = `You are HelpPilot AI. Use ONLY this context to answer:\n${knowledgeContext}\n\nVisitor: "${message}"`;

    // 2. Direct Gemini 2.5 Flash Call
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      }
    );

    const aiData = await geminiResponse.json();

    // Direct error output from Google API
    if (aiData.error) {
      return res.status(200).json({ reply: `Gemini API Error: ${aiData.error.message}` });
    }

    const replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "No output text from Gemini.";
    return res.status(200).json({ reply: replyText });

  } catch (err) {
    return res.status(500).json({ error: 'Server Catch Error: ' + err.message });
  }
}
