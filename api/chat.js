export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, appId } = req.body;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
        }

        const prompt = `You are a helpful customer support AI for HelpPilot AI (Workspace: ${appId}). Answer this customer query directly and helpfully: "${message}". Keep your response natural and concise.`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await geminiRes.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hello! How can I assist you further today?";
        
        // Simple sentiment check
        const isFrustrated = message.toLowerCase().includes('angry') || message.toLowerCase().includes('worst') || message.toLowerCase().includes('refund') || message.toLowerCase().includes('human');

        return res.status(200).json({
            reply: replyText.trim(),
            sentiment: isFrustrated ? "frustrated" : "neutral",
            escalated: isFrustrated ? true : false
        });

    } catch (err) {
        return res.status(200).json({
            reply: "Thanks for reaching out! How can I help you today?",
            sentiment: "neutral",
            escalated: false
        });
    }
}
