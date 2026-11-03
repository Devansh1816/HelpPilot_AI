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
      return res.status(200).json({ reply: 'GEMINI_API_KEY is missing in Vercel Environment Variables.' });
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

    const systemPrompt = `You are HelpPilot AI, a helpful customer support assistant. Answer the user's question concisely based ONLY on this context:\n\n=== KNOWLEDGE BASE ===\n${knowledgeContext}\n======================\n\nQuestion: "${message}"`;

    // 2. Direct Call to Google's Recommended Model (gemini-3.8-flash)
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let replyText = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }]
            })
          }
        );

        const aiData = await geminiRes.json();

        if (aiData.candidates && aiData.candidates[0]?.content?.parts?.[0]?.text) {
          replyText = aiData.candidates[0].content.parts[0].text;
          break;
        } else if (aiData.error) {
          lastError = aiData.error.message;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: `Google API Error: ${lastError || 'Unable to generate AI response.'}` });

  } catch (err) {
    return res.status(500).json({ error: 'Server Error: ' + err.message });
  }
}
