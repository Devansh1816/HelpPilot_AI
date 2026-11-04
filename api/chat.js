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

        const prompt = `You are an AI customer support bot for HelpPilot AI. Answer this query directly and helpfully: "${message}"`;

        // Pehle primary model try karenge, agar demand spike aayi toh fallback model chalega
        const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
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
                    break; // Sahi response milne par loop exit ho jayega
                }
            } catch (e) {
                // Primary fail hone par agla model try karega
                continue;
            }
        }

        if (!aiReply) {
            aiReply = "High demand right now. We have received your query regarding '" + message + "' and our team is looking into it.";
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
            reply: "Server error: " + err.message,
            sentiment: "neutral",
            escalated: false
        });
    }
}
