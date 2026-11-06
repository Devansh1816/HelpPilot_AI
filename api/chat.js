import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_ANON_KEY,
    { db: { schema: 'public' } }
);

export default async function handler(req, res) {
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

        let reply = "";
        let isEscalated = false;

        // 1. Static Keywords
        if (lowerMsg.includes('human') || lowerMsg.includes('agent') || lowerMsg.includes('complaint')) {
            reply = "I have escalated your issue to a human support agent. Our team will contact you shortly!";
            isEscalated = true;
        } else if (lowerMsg.includes('refund') || lowerMsg.includes('return')) {
            reply = "We offer a full 14-day money-back guarantee on all orders.";
        } else if (lowerMsg.includes('shipping') || lowerMsg.includes('delivery')) {
            reply = "Standard shipping takes 3 to 5 business days.";
        } else {
            // 2. Check Supabase Knowledge Base First
            try {
                const { data: kbData } = await supabase
                    .from('knowledge_base')
                    .select('*');
                
                if (kbData && kbData.length > 0) {
                    const matched = kbData.find(item => {
                        const q = (item.question || '').toLowerCase();
                        return lowerMsg.includes(q) || q.includes(lowerMsg);
                    });
                    if (matched) {
                        reply = matched.answer;
                    }
                }
            } catch (kbErr) {
                console.error("KB Fetch Error:", kbErr);
            }

            // 3. Fallback to Gemini if not in KB
            if (!reply) {
                const apiKey = process.env.GEMINI_API_KEY;
                if (apiKey) {
                    try {
                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: `You are HelpPilot AI, a helpful e-commerce customer support assistant. Answer concisely in 1-2 sentences.\nUser Question: ${message}`
                                    }]
                                }]
                            })
                        });

                        const data = await response.json();
                        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    } catch (err) {
                        console.error("Gemini Fetch Error:", err);
                    }
                }
            }

            // 4. Default Fallback
            if (!reply) {
                reply = "Thanks for reaching out! How can I assist you with your order or store questions today?";
            }
        }

        // 5. Save to Supabase
        try {
            await supabase.from('conversations').insert([
                {
                    app_id: workspaceId || 'default',
                    visitor_id: 'visitor_1029',
                    message: message,
                    status: isEscalated ? 'escalated' : 'active'
                }
            ]);
        } catch (dbErr) {
            console.error("Supabase Insert Error:", dbErr);
        }

        return res.status(200).json({
            reply: reply,
            escalated: isEscalated
        });

    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
