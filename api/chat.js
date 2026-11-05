export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, appId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const lowerMsg = message.toLowerCase();

    // Trigger escalation if frustrated or requesting human
    const escalationKeywords = ['agent', 'human', 'support person', 'talk to someone', 'worst', 'bad service', 'complaint'];
    const isEscalated = escalationKeywords.some(keyword => lowerMsg.includes(keyword));

    if (isEscalated) {
        return res.status(200).json({
            reply: "I have escalated your issue to a human support agent. Our team will review this message shortly!",
            escalated: true
        });
    }

    // Default Knowledge Base Responses
    if (lowerMsg.includes('refund')) {
        return res.status(200).json({
            reply: "We offer a full 14-day money-back guarantee for all subscription plans. You can request a refund anytime from your account dashboard."
        });
    }

    if (lowerMsg.includes('shipping') || lowerMsg.includes('delivery')) {
        return res.status(200).json({
            reply: "Standard delivery takes 3 to 5 business days across India."
        });
    }

    return res.status(200).json({
        reply: `Hello! Welcome to HelpPilot AI support. How can I assist you with your workspace today?`
    });
}
