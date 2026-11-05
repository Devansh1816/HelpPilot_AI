import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST: Save new Q&A pair from Knowledge Base workspace
  if (req.method === 'POST') {
    const { app_id, title, content } = req.body;
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert([{ app_id: app_id || '11111111-1111-1111-1111-111111111111', title, content }]);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, data });
  }

  // GET: Fetch trained Q&A list for the workspace view
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*');

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
