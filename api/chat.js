export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body || {};
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!message) return res.status(200).json({ reply: 'Please enter a message.' });
    if (!groqApiKey) return res.status(200).json({ reply: 'Error: GROQ_API_KEY is missing.' });

    let knowledgeContext = "We offer a full 14-day money-back guarantee for all subscription plans. No questions asked.";

    // Try fetching from Supabase safely
    if (supabaseUrl && supabaseKey) {
      try {
        const supaRes = await fetch(`${supabaseUrl.trim()}/rest/v1/knowledge_base?select=title,content`, {
          headers: {
            'apikey': supabaseKey.trim(),
            'Authorization': `Bearer ${supabaseKey.trim()}`,
            'Content-Type': 'application/json'
          }
        });
        if (supaRes.ok) {
          const docs = await supaRes.json();
          if (Array.isArray(docs) && docs.length > 0) {
            knowledgeContext = docs.map(d => `Title: ${d.title}\nContent: ${d.content}`).join("\n\n");
          }
        }
      } catch (e) {
        console.error("Supabase error:", e);
      }
    }

    const systemPrompt = `You are HelpPilot AI, a customer support assistant. Answer the user's question concisely using ONLY this knowledge base:\n\n=== KNOWLEDGE BASE ===\n${knowledgeContext}\n======================\n\nQuestion: "${message}"`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.2
      })
    });

    const data = await groqRes.json();
    if (data.error) {
      return res.status(200).json({ reply: `Groq Error: ${data.error.message}` });
    }

    const replyText = data.choices?.[0]?.message?.content;
    return res.status(200).json({ reply: replyText || 'No response generated.' });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
