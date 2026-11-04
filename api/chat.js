export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body || {};
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!message) return res.status(200).json({ reply: 'Please enter a message.' });
    if (!geminiKey) return res.status(200).json({ reply: 'Error: GEMINI_API_KEY is missing in Vercel settings.' });

    let knowledgeContext = "We offer a full 14-day money-back guarantee for all subscription plans. No questions asked.";

    // Gemini API Direct Call (gemini-1.5-flash)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `You are HelpPilot AI, a customer support assistant. Answer concisely based on this info:\n\nContext: ${knowledgeContext}\n\nQuestion: ${message}` }
            ]
          }
        ]
      })
    });

    const data = await geminiRes.json();
    if (data.error) {
      return res.status(200).json({ reply: `Gemini Error: ${data.error.message}` });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ reply: replyText || 'No response generated.' });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
