import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymvhnwcteeonvwhhoksd.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_iFIOgMMDWFEwNEwT-0xKtw_Eurj7szi'; // Fallback Key
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
    const cleanMsg = (message || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. Human Escalation Check
    const escalationKeywords = ['human', 'agent', 'support', 'complaint', 'person', 'manager'];
    if (escalationKeywords.some(kw => lowerMsg.includes(kw))) {
      saveLog(workspaceId, visitorId, cleanMsg, 'escalated');
      return res.status(200).json({
        reply: "I am routing your query to a human support agent. Please stay on line!",
        status: "escalated"
      });
    }

    let reply = "";

    // 2. Knowledge Base Search
    try {
      const { data: kbEntries } = await supabase
        .from('knowledge_base')
        .select('content, title');

      if (kbEntries && kbEntries.length > 0) {
        const matched = kbEntries.find(item => {
          if (!item.title) return false;
          const t = item.title.toLowerCase();
          return lowerMsg.includes(t) || t.includes(lowerMsg);
        });
        if (matched) reply = matched.content;
      }
    } catch (e) {
      console.error("KB Fetch Exception:", e);
    }

    // 3. Fallback Refund Policy
    if (!reply && (lowerMsg.includes('refund') || lowerMsg.includes('return') || lowerMsg.includes('policy'))) {
      reply = "HelpPilot AI offers a free plan up to 100 replies. Our Pro Plan costs Rs 499 per month. We provide a 100% full refund within 7 days of purchase with no questions asked.";
    }

    // 4. Gemini AI Call (Greetings & Generic Questions)
    if (!reply && GEMINI_API_KEY) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are an AI e-commerce assistant. Answer in 1 short polite sentence in user's language: ${cleanMsg}` }] }]
            })
          }
        );
        const aiData = await aiRes.json();
        reply = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (aiErr) {
        console.error("Gemini Error:", aiErr);
      }
    }

    // Default Fallback
    if (!reply) {
      reply = "Hello! How can I assist you with your store orders or questions today?";
    }

    saveLog(workspaceId, visitorId, cleanMsg, 'active');

    return res.status(200).json({ reply, status: 'active' });

  } catch (err) {
    console.error("Critical Handler Error:", err);
    return res.status(200).json({
      reply: "Hello! How can I assist you with your store today?",
      status: "active"
    });
  }
}

async function saveLog(appId, visitorId, message, status) {
  try {
    await supabase.from('conversations').insert([{
      app_id: appId,
      visitor_id: visitorId || 'visitor_1029',
      message: message,
      status: status
    }]);
  } catch (e) {
    console.error("Log error ignored", e);
  }
}
