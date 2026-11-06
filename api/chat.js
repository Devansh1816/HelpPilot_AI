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
      try {
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
      } catch (trialErr) {
        console.error("Trial check bypassed:", trialErr);
      }
    }

    const cleanMsg = (message || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();
    
    // 1. Human Escalation Check
    const escalationKeywords = ['human', 'agent', 'support', 'complaint', 'person', 'manager', 'real person'];
    if (escalationKeywords.some(kw => lowerMsg.includes(kw))) {
      await logChat(workspaceId, visitorId, cleanMsg, 'escalated');
      return res.status(200).json({
        reply: "I am routing your query to a human support agent. Please stay on line!",
        status: "escalated"
      });
    }

    let reply = "";

    // 2. Fetch Knowledge Base from Supabase
    try {
      const { data: kbData } = await supabase
        .from('knowledge_base')
        .select('content, title');

      if (kbData && kbData.length > 0) {
        const matched = kbData.find(item => {
          if (!item.title) return false;
          const t = item.title.toLowerCase();
          return lowerMsg.includes(t) || t.includes(lowerMsg);
        });
        if (matched) reply = matched.content;
      }
    } catch (e) {
      console.error("KB Query Error:", e);
    }

    // 3. Fallback Refund Policy Check (If KB query returns nothing)
    if (!reply && (lowerMsg.includes('refund') || lowerMsg.includes('return') || lowerMsg.includes('policy'))) {
      reply = "HelpPilot AI offers a free plan up to 100 replies. Our Pro Plan costs Rs 499 per month. We provide a 100% full refund within 7 days of purchase with no questions asked.";
    }

    // 4. Gemini AI Call (For generic greetings like 'hii', 'hello')
    if (!reply && GEMINI_API_KEY) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are a store assistant. Respond politely in 1 short sentence to: ${cleanMsg}` }] }]
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
      reply = "Hello! How can I assist you with your store orders or queries today?";
    }

    // Log chat to DB
    await logChat(workspaceId, visitorId, cleanMsg, 'active');

    return res
