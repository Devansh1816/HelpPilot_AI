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

        const prompt = `You are a helpful customer support AI for HelpPilot AI (Workspace: ${appId}). User message: "${message}". 
        Answer the user's query politely and directly. Also check if the user is frustrated or asking for a human agent.
        Return ONLY valid JSON in this format:
        {
            "reply": "your support answer here",
            "sentiment": "neutral" or "frustrated",
            "escalated": true or false
        }`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await geminiRes.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        let parsedResponse;
        try {
            const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResponse = JSON.parse(cleanJsonText);
        } catch (e) {
            parsedResponse = {
                reply: rawText || "Here is the information you requested regarding your support query.",
                sentiment: "neutral",
                escalated: false
            };
        }

        return res.status(200).json({
            reply: parsedResponse.reply,
            sentiment: parsedResponse.sentiment || "neutral",
            escalated: parsedResponse.escalated || false
        });

    } catch (err) {
        return res.status(200).json({
            reply: "We have received your query regarding '" + message + "' and our team is looking into it.",
            sentiment: "neutral",
            escalated: false
        });
    }
}
