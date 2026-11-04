import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, appId } = req.body || {};

    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Fallback app_id agar pass na ho
    const targetAppId = appId || '11111111-1111-1111-1111-111111111111';

    // Fetch FAQs from Supabase knowledge_base table
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('question, answer')
      .eq('app_id', targetAppId);

    let matchedAnswer = null;

    if (!error && data && data.length > 0) {
      const lowerMsg = message.toLowerCase();
      const found = data.find(item => 
        lowerMsg.includes(item.question.toLowerCase()) ||
        item.question.toLowerCase().split(' ').some(word => word.length > 3 && lowerMsg.includes(word))
      );
      if (found) {
        matchedAnswer = found.answer;
      }
    }

    // Default fallback agar database mein match na mile
    if (!matchedAnswer) {
      matchedAnswer = `Thank you for your question about "${message}". Our support team is available 24/7 to assist you.`;
    }

    return res.status(200).json({ reply: matchedAnswer });

  } catch (err) {
    return res.status(500).json({ reply: 'Server Exception: ' + err.message });
  }
}
