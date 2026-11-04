export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message } = req.body;
    const cleanMsg = (message || '').toLowerCase().trim();

    // 1. FAST RULE-BASED MATCHING (100% Reliable Instant Support Answers)
    let replyText = "";
    if (cleanMsg.includes('refund') || cleanMsg.includes('money back')) {
        replyText = "We offer a full 14-day money-back guarantee for all subscription plans. You can request a refund anytime from your account dashboard.";
    } else if (cleanMsg.includes('price') || cleanMsg.includes('plan') || cleanMsg.includes('cost')) {
        replyText = "HelpPilot AI offers flexible plans starting from ₹4,999/month for the Pro Tier with full automation features.";
    } else if (cleanMsg.includes('hello') || cleanMsg.includes('hi') || cleanMsg.includes('hey')) {
        replyText = "Hello! Welcome to HelpPilot AI support. How can I assist you with your workspace today?";
    }

    // Sentiment & Auto-escalation Logic
    const isFrustrated = cleanMsg.includes('refund') || cleanMsg.includes('angry') || cleanMsg.includes('human') || cleanMsg.includes('worst') || cleanMsg.includes('bad');

    // Agar Knowledge Base rule match ho gaya toh direct response return karo
    if (replyText) {
        return res.status(200).json({
            reply: replyText,
            sentiment: isFrustrated ? "frustrated" : "neutral",
            escalated: isFrustrated
        });
    }

    // 2. GEMINI API FALLBACK FOR UNKNOWN QUERIES
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                reply: "Thank you for reaching out. An agent will assist you shortly.",
                sentiment: isFrustrated ? "frustrated" : "neutral",
                escalated: isFrustrated
            });
        }

        const prompt = `You are a support bot for HelpPilot AI SaaS. Answer concisely: "${message}"`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        const apiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return res.status(200).json({
            reply: apiReply ? apiReply.trim() : "Thanks for your query. Our team is looking into this.",
            sentiment: isFrustrated ? "frustrated" : "neutral",
            escalated: isFrustrated
        });

    } catch (err) {
        return res.status(200).json({
            reply: "Thank you for reaching out. Our support agent will assist you shortly.",
            sentiment: isFrustrated ? "frustrated" : "neutral",
            escalated: isFrustrated
        });
    }
}
