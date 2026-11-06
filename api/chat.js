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

    const lowerMsg = (message || '').trim().toLowerCase();
    const escalationKeywords = ['human', 'agent', 'support', 'complaint', 'person', 'manager'];
    const isEscalation = escalationKeywords.some(kw => lowerMsg.includes(kw));

    let reply = "";
    let status = isEscalation ? 'escalated' : 'active';

    if (isEscalation) {
      reply = "I am routing your query to a human support agent. Please stay on line!";
    } else {
      // 1. Fetch Knowledge Base Entries
      const { data: kbData } = await supabase
        .from('knowledge_base')
        .select('content, title, app_id');

      let matchedKB = null;
      if (kbData && kbData.length > 0) {
        matchedKB = kbData.find(item => {
          if (!item.title) return false;
          const titleLower = item.title.toLowerCase();
          const words = lowerMsg.split(' ');
          return words.some(w => w.length > 2 && titleLower.includes(w)) || lowerMsg.includes(titleLower) || titleLower.includes(lowerMsg);
        });
      }

      if (matchedKB) {
        reply = matchedKB.content;
      } else if (GEMINI_API_KEY) {
        // 2. Direct Gemini 1.5 Flash Call
        try {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are an AI customer support bot for an e-commerce store. Answer helpful and short in 1-2 sentences: ${message}` }] }]
            })
          });
          const aiData = await aiRes.json();
          reply = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (e) {
          console.error("AI Fetch Error:", e);
        }
      }

      if (!reply) {
        reply = "We offer a 14-day return and refund policy on all items. How else can I help you today?";
      }
    }

    // Save Log to Supabase
    await supabase.from('conversations').insert([{
      app_id: workspaceId,
      visitor_id: visitorId || 'visitor_1029',
      message: message,
      status: status
    }]);

    return res.status(200).json({ reply, status });
  } catch (err) {
    console.error("Handler Exception:", err);
    return res.status(200).json({
      reply: "Thank you for reaching out! A support team member will assist you shortly.",
      status: "active"
    });
  }
}
