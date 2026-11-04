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

        const prompt = `You are a professional customer support AI assistant for HelpPilot AI (Workspace ID: ${appId}). 
        Analyze the user's message: "${message}".
        
        Determine if the user is frustrated, angry, or asking for a human agent. 
        If frustrated or demanding a human, set "escalated" to true and "sentiment" to "frustrated". Otherwise set "escalated" to false and "sentiment" to "neutral".
        
        Provide a helpful, polite support response.
        
        Respond ONLY in valid JSON format with this exact structure:
        {
            "reply": "Your helpful support answer here",
            "sentiment": "neutral" or "frustrated",
            "escalated": true or false
        }`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await geminiRes.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResponse = JSON.parse(cleanJsonText);

        return res.status(200).json({
            reply: parsedResponse.reply || "Hello! How can I assist you further today?",
            sentiment: parsedResponse.sentiment || "neutral",
            escalated: parsedResponse.escalated || false
        });

    } catch (err) {
        return res.status(200).json({
            reply: "Thanks for reaching out! Our support team has received your query and will get back to you shortly.",
            sentiment: "neutral",
            escalated: false
        });
    }
}
