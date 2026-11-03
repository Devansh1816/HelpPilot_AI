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
      return res.status(200).json({ reply: '[V2 DEBUG] GEMINI_API_KEY is missing in Vercel Environment Variables.' });
    }

    // 1. Fetch Knowledge Base from Supabase
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

    const systemPrompt = `You are HelpPilot AI. Use ONLY this context to answer accurately:\n${knowledgeContext}\n\nVisitor Question: "${message}"`;

    // 2. Call Gemini 2.5 Flash API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      }
    );

    const aiData = await geminiRes.json();

    // Show Exact Google API Error Message if any
    if (aiData.error) {
      return res.status(200).json({ reply: `[V2 DEBUG] Google API Error [${aiData.error.code}]: ${aiData.error.message}` });
    }

    const replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: '[V2 DEBUG] API returned empty response: ' + JSON.stringify(aiData) });

  } catch (err) {
    return res.status(500).json({ error: '[V2 DEBUG] Server Error: ' + err.message });
  }
}
