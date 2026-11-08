
import { verifyOwner } from '../lib/server-auth.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const auth = await verifyOwner(req);

  if (!auth.ok) {
    return res.status(auth.status).json({
      error: auth.error
    });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await auth.supabase
        .from('knowledge_base')
        .select('id, app_id, title, content, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    const { app_id, title, content } = req.body || {};

    if (
      typeof app_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(app_id) ||
      typeof title !== 'string' ||
      typeof content !== 'string'
    ) {
      return res.status(400).json({
        error: 'A valid app_id, title and content are required.'
      });
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (
      cleanTitle.length === 0 ||
      cleanTitle.length > 200 ||
      cleanContent.length === 0 ||
      cleanContent.length > 20000
    ) {
      return res.status(400).json({
        error: 'Title or content is empty or exceeds the allowed length.'
      });
    }

    const { data, error } = await auth.supabase
      .from('knowledge_base')
      .insert([{
        app_id,
        title: cleanTitle,
        content: cleanContent
      }])
      .select('id, app_id, title, content, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Knowledge API error:', error);

    return res.status(500).json({
      error: 'Unable to process the knowledge-base request.'
    });
  }
}
