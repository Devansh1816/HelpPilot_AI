export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { appId, message } = req.body || {};
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!message) {
      return res.status(200).json({ reply: 'Please enter a message.' });
    }

    if (!groqApiKey) {
      return res.status(200).json({ reply: 'Error: GROQ_API_KEY is missing in Vercel settings.' });
    }

    // 1. Groq Direct API Call (Using standard llama-3.3-70b-versatile)
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are HelpPilot AI, a helpful customer support assistant. Answer the user concisely.' },
          { role: 'user', content: message }
        ],
        temperature: 0.2
      })
    });

    const data = await groqRes.json();

    if (data.error) {
      return res.status(200).json({ reply: `Groq API Error: ${data.error.message}` });
    }

    const replyText = data.choices?.[0]?.message?.content;
    return res.status(200).json({ reply: replyText || 'Hello! I am your AI assistant. How can I help you today?' });

  } catch (err) {
    // Catch-all ensures the widget NEVER shows connection error
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
