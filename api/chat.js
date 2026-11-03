import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { appId, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Supabase Knowledge Base Query
    const { data: docs } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('app_id', appId);

    let knowledgeContext = "No specific knowledge base uploaded yet.";
    if (docs && docs.length > 0) {
      knowledgeContext = docs.map(d => `Title: ${d.title}\nContent: ${d.content}`).join("\n\n");
    }

    const systemPrompt = `
You are HelpPilot AI, an intelligent customer support assistant for a business website.
Use ONLY the following knowledge base context to answer the visitor's question accurately.
If the answer is not in the context, politely state that you don't have that information right now. Keep responses concise, professional, and friendly.

=== KNOWLEDGE BASE CONTEXT ===
${knowledgeContext}
=============================

Visitor Question: "${message}"
`;

    // Gemini 2.5 Flash API Call
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      }
    );

    const aiData = await geminiResponse.json();
    const replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble connecting to the AI server.";

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
