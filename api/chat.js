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
    const { message, appId, visitorId } = req.body;
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
      // 1. Smart Knowledge Base Matching Logic
      let matchedKB = null;
      try {
        const { data: kbData } = await supabase
          .from('knowledge_base')
          .select('content, title, app_id');

        if (kbData && kbData.length > 0) {
          matchedKB = kbData.find(item => {
            if (!item.title) return false;
            const titleLower = item.title.toLowerCase();
            return (
              (item.app_id === workspaceId || item.app_id === 'default' || item.app_id === 'devansh_admin') &&
              (lowerMsg.includes(titleLower) || titleLower.includes(lowerMsg) || lowerMsg.split(' ').some(word => word.length > 3 && titleLower.includes(word)))
            );
          });
        }
      } catch (kbErr) {
        console.error("KB Search Error:", kbErr);
      }

      if (matchedKB) {
        reply = matchedKB.content;
      } else if (GEMINI_API_KEY) {
        // 2. Gemini AI Response Generation Engine
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `You are an AI customer support assistant for HelpPilot AI store. Respond accurately and politely in 1-2 concise sentences matching the user's language (English, Hindi, or Hinglish). User Query: ${message}`
                      }
                    ]
                  }
                ]
              })
            }
          );

          const aiData = await geminiRes.json();
          reply = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!reply) {
            // Backup Gemini REST endpoint format
            const geminiResBackup = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `Answer nicely in 1 sentence: ${message}` }] }]
                })
              }
            );
            const backupData = await geminiResBackup.json();
            reply = backupData?.candidates?.[0]?.content?.parts?.[0]?.text;
          }
        } catch (aiErr) {
          console.error("Gemini AI API Call Error:", aiErr);
        }
      }

      if (!reply) {
        reply = "Hello! I am your AI assistant. How can I help you with your order or store questions today?";
      }
    }

    // Insert conversation log
    try {
      await supabase.from('conversations').insert([{
        app_id: workspaceId,
        visitor_id: visitorId || 'visitor_1029',
        message: message,
        status: status
      }]);
    } catch (dbErr) {
      console.error("DB Log Error:", dbErr);
    }

    return res.status(200).json({ reply, status });
  } catch (err) {
    console.error("Chat Handler Error:", err);
    return res.status(200).json({
      reply: "Hi there! I am here to assist you. What can I help you with today?",
      status: "active"
    });
  }
}
