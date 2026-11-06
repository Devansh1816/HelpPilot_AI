import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymvhnwcteeonvwhhoksd.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_WORKSPACES = ['devansh_admin', 'helppilot_admin', 'test_store', 'default'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, appId, visitorId } = req.body || {};
    const workspaceId = appId || 'default';

    // 14-Day Free Trial Check
    if (!ADMIN_WORKSPACES.includes(workspaceId)) {
      const { data: firstConv } = await supabase
        .from('conversations')
        .select('created_at')
        .eq('app_id', workspaceId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (firstConv && firstConv.length > 0) {
        const startDate = new Date(firstConv[0].created_at);
        const currentDate = new Date();
        const diffDays = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 14) {
          return res.status(403).json({
            reply: "Trial Expired: This store's 14-day free trial has ended. Please upgrade to HelpPilot AI Pro.",
            status: "trial_expired"
          });
        }
      }
    }

    const cleanMsg = (message || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();
    
    // Human Escalation Check
    const escalationKeywords = ['human', 'agent', 'support', 'complaint', 'person', 'manager', 'real person'];
    const isEscalation = escalationKeywords.some(kw => lowerMsg.includes(kw));

    let reply = "";
    let status = isEscalation ? 'escalated' : 'active';

    if (isEscalation) {
      reply = "I am routing your query to a human support agent. Please stay on line!";
    } else {
      // 1. Strict Knowledge Base Matching
      let matchedKB = null;
      try {
        const { data: kbData } = await supabase
          .from('knowledge_base')
          .select('content, title, app_id');

        if (kbData && kbData.length > 0 && lowerMsg.length > 3) {
          matchedKB = kbData.find(item => {
            if (!item.title) return false;
            const titleLower = item.title.toLowerCase();
            // Match workspace and exact title or clear phrase match (avoiding false matches like 'hi')
            const isCorrectWorkspace = (item.app_id === workspaceId || item.app_id === 'default' || item.app_id === 'devansh_admin');
            return isCorrectWorkspace && (lowerMsg.includes(titleLower) || (titleLower.length >= 5 && lowerMsg.includes(titleLower)));
          });
        }
      } catch (kbErr) {
        console.error("KB Search Error:", kbErr);
      }

      if (matchedKB) {
        reply = matchedKB.content;
      } else if (GEMINI_API_KEY) {
        // 2. Dynamic Gemini AI Call
        try {
          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `You are a helpful customer support AI assistant for an e-commerce store. Respond politely and concisely in 1-2 short sentences in the user's language (English, Hindi, or Hinglish). User Query: ${cleanMsg}`
                      }
                    ]
                  }
                ]
              })
            }
          );
          const aiData = await aiRes.json();
          reply = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (e) {
          console.error("Gemini API Error:", e);
        }
      }

      if (!reply) {
        reply = "Hello! I am your AI assistant. How can I help you with your store orders or queries today?";
      }
    }

    // Insert conversation log to Supabase
    try {
      await supabase.from('conversations').insert([{
        app_id: workspaceId,
        visitor_id: visitorId || 'visitor_1029',
        message: cleanMsg,
        status: status
      }]);
    } catch (dbErr) {
      console.error("DB Log Error:", dbErr);
    }

    return res.status(200).json({ reply, status });
  } catch (err) {
    console.error("Handler Exception:", err);
    return res.status(200).json({
      reply: "Hi there! How can I assist you with your store today?",
      status: "active"
    });
  }
}
