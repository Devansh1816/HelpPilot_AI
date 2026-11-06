import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymvhnwcteeonvwhhoksd.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE'; // Backup fallback
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6LiFN3YYxK1ooBLgkl32ZY1vcPlGkowmdMMznCNpqFe7Q';

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

    const lowerMsg = (message || '').toLowerCase();
    const escalationKeywords = ['human', 'agent', 'support', 'complaint', 'person', 'manager'];
    const isEscalation = escalationKeywords.some(kw => lowerMsg.includes(kw));

    let reply = "";
    let status = isEscalation ? 'escalated' : 'active';

    if (isEscalation) {
      reply = "I am routing your query to a human support agent. Please stay on line!";
    } else {
      // Safe KB Fetching
      let matchedKB = null;
      try {
        const { data: kbData } = await supabase
          .from('knowledge_base')
          .select('content, title, app_id');

        if (kbData && kbData.length > 0) {
          matchedKB = kbData.find(item => 
            (item.app_id === workspaceId || item.app_id === 'default') && 
            item.title && lowerMsg.includes(item.title.toLowerCase())
          );
        }
      } catch (kbErr) {
        console.error("KB Fetch Error:", kbErr);
      }

      if (matchedKB) {
        reply = matchedKB.content;
      } else if (GEMINI_API_KEY) {
        // Gemini AI Fallback Engine
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are an AI support assistant for an e-commerce store. Answer in 1-2 concise sentences in the customer's language (English, Hindi, or Hinglish): ${message}` }] }]
            })
          });
          const aiData = await response.json();
          reply = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Thank you for reaching out! A support team member will assist you shortly.";
        } catch (aiErr) {
          reply = "Thank you for reaching out! A support team member will assist you shortly.";
        }
      } else {
        reply = "Thank you for reaching out! A support representative will assist you shortly.";
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
    } catch (dbInsertErr) {
      console.error("Insert Error:", dbInsertErr);
    }

    return res.status(200).json({ reply, status });
  } catch (err) {
    console.error("Chat API Critical Error:", err);
    return res.status(200).json({ 
      reply: "Thank you for reaching out! A support agent will get back to you shortly.", 
      status: "fallback" 
    });
  }
}
