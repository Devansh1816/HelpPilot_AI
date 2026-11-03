export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { appId, message } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Direct REST Fetch from Supabase (Zero External Library Needed)
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

    // 2. Prompt Construction for Gemini AI
    const systemPrompt = `
You are HelpPilot AI, an intelligent customer support assistant for a business website.
Use ONLY the following knowledge base context to answer the visitor's question accurately.
If the answer is not in the context, politely state that you don't have that information right now and offer to connect them with a human agent. Keep responses concise, professional, and friendly.

=== KNOWLEDGE BASE CONTEXT ===
${knowledgeContext}
=============================

Visitor Question: "${message}"
`;

    // 3. Direct Gemini 2.5 Flash API Call
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      }
    );

    const aiData = await geminiResponse.json();
    const replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble connecting to Gemini API. Please check your GEMINI_API_KEY in Vercel.";

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
}
