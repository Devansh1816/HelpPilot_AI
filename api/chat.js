export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message } = req.body;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                reply: "API Key missing in Vercel environment variables.",
                sentiment: "neutral",
                escalated: false
            });
        }

        const prompt = `You are a helpful customer support AI assistant for HelpPilot AI. Answer this query directly and concisely: "${message}"`;

        // Direct valid endpoints try karenge
        const models = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-2.0-flash'];
        let aiReply = "";

        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    aiReply = data.candidates[0].content.parts[0].text;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!aiReply) {
            aiReply = "Hello! I am currently operating in assistant mode. How can I help you today?";
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
            reply: "Server connection active. How can I assist you?",
            sentiment: "neutral",
            escalated: false
        });
    }
}
