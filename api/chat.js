export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message } = req.body;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API key missing' });

        const prompt = `You are a polite customer support AI. Customer message: "${message}". Reply concisely.`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await geminiRes.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Let me check that for you.";
        
        const textLower = message.toLowerCase();
        const isFrustrated = textLower.includes('refund') || textLower.includes('angry') || textLower.includes('human') || textLower.includes('worst');

        return res.status(200).json({
            reply: replyText.trim(),
            sentiment: isFrustrated ? "frustrated" : "neutral",
            escalated: isFrustrated
        });

    } catch (err) {
        return res.status(200).json({
            reply: "Our team has received your query and will assist you shortly.",
            sentiment: "neutral",
            escalated: true
        });
    }
}
