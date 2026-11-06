import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymvhnwcteeonvwhhoksd.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_WORKSPACES = ['devansh_admin', 'helppilot_admin', 'test_store'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, appId, visitorId } = req.body;
    const workspaceId = appId || 'default';

    // 14-Day Free Trial Check (Skipped for Devansh Admin Workspaces)
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

    const lowerMsg = message.toLowerCase();
    const escalationKeywords = ['human', 'agent', 'support', 'complaint', 'person', 'manager'];
    const isEscalation = escalationKeywords.some(kw => lowerMsg.includes(kw));

    let reply = "";
    let status = isEscalation ? 'escalated' : 'active';

    if (isEscalation) {
      reply = "I am routing your query to a human support agent. Please stay on line!";
    } else {
      // Fetch specific KB for this store's app_id, with fallback to default
      const { data: kbData } = await supabase
        .from('knowledge_base')
        .select('content, title')
        .or(`app_id.eq.${workspaceId},app_id.eq.default`);  let matchedKB = null; if (kbData && kbData.length > 0) { matchedKB = kbData.find(item => lowerMsg.includes(item.title.toLowerCase())); }  if (matchedKB) { reply = matchedKB.content; } else if (GEMINI_API_KEY) { // Gemini AI Fallback Engine const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are an AI support assistant for an e-commerce store. Answer in 1-2 concise sentences in the customer's
