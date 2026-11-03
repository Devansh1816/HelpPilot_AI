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

    const cleanKey = groqApiKey.trim();

    // List of alternative models to test sequentially for your API key
    const candidateModels = [
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
      'llama3-8b-8192',
      'llama3-70b-8192'
    ];

    let replyText = null;
    let lastErrorMsg = '';

    for (const modelName of candidateModels) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: 'You are HelpPilot AI, a helpful customer support assistant. Answer the user concisely.' },
              { role: 'user', content: message }
            ],
            temperature: 0.2
          })
        });

        const data = await groqRes.json();

        if (data.choices?.[0]?.message?.content) {
          replyText = data.choices[0].message.content;
          break; // Successfully got response from an active model!
        } else if (data.error) {
          lastErrorMsg = data.error.message;
        }
      } catch (err) {
        lastErrorMsg = err.message;
      }
    }

    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: `Groq API Error: ${lastErrorMsg || 'No accessible models found.'}` });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
