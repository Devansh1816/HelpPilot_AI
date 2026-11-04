export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message } = req.body;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                reply: "API Key is missing in Vercel environment variables.",
                sentiment: "neutral",
                escalated: false
            });
        }

        const promptText = `You are a helpful customer support AI assistant. Answer this query concisely: "${message}"`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptText }]
                }]
            })
        });

        const data = await response.json();
        let aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiReply) {
            aiReply = data.error?.message || "Hello! How can I assist you with your account today?";
        }

        const lowerMsg = (message || '').toLowerCase();
        const isFrustrated = lowerMsg.includes('refund') || lowerMsg.includes('angry') || lowerMsg.includes('human') || lowerMsg.includes('worst');

        return res.status(200).json({
            reply: aiReply.trim(),
            sentiment: isFrustrated ? "frustrated" : "neutral",
            escalated: isFrustrated
        });

    } catch (err) {
        return res.status(200).json({
            reply: "Hello! How can I assist you with your account today?",
            sentiment: "neutral",
            escalated: false
        });
    }
}
