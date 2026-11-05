export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, workspaceId } = req.body;
        const lowerMsg = (message || '').toLowerCase();

        // 1. Keyword-based Rules & Escalation
        if (lowerMsg.includes('human') || lowerMsg.includes('agent') || lowerMsg.includes('complaint')) {
            return res.status(200).json({
                reply: "I have escalated your issue to a human support agent. Our team will contact you shortly!",
                escalated: true
            });
        }

        if (lowerMsg.includes('refund') || lowerMsg.includes('return')) {
            return res.status(200).json({
                reply: "We offer a full 14-day money-back guarantee on all orders.",
                escalated: false
            });
        }

        if (lowerMsg.includes('shipping') || lowerMsg.includes('delivery')) {
            return res.status(200).json({
                reply: "Standard shipping takes 3 to 5 business days.",
                escalated: false
            });
        }

        // 2. Dynamic Gemini API Fallback
        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
           const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are HelpPilot AI, a helpful customer support assistant for an e-commerce store (Workspace: ${workspaceId || 'General'}). Answer the user concisely and professionally in 2-3 sentences max.\n\nUser Question: ${message}`
                        }]
                    }]
                })
            });

            const data = await response.json();
            const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (aiReply) {
                return res.status(200).json({
                    reply: aiReply,
                    escalated: false
                });
            }
        }

        // Default response if API key is missing or call fails
        return res.status(200).json({
            reply: "Hello! Welcome to HelpPilot AI support. How can I assist you today?",
            escalated: false
        });

    } catch (error) {
        console.error("Chat API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
