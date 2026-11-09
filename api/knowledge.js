import { createClient } from '@supabase/supabase-js';

function sendError(res, status, error) {
  return res.status(status).json({ success: false, error });
}

async function getStoreContext(req) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return { error: 'Server configuration error.', status: 500 };
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return { error: 'Authentication required.', status: 401 };
  }

  const authClient = createClient(url, anonKey);
  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !authData?.user) {
    return { error: 'Invalid or expired session.', status: 401 };
  }

  const supabase = createClient(url, serviceRoleKey);

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('app_uuid')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (workspaceError) {
    console.error('Workspace lookup error:', workspaceError);
    return { error: 'Unable to verify your workspace.', status: 500 };
  }

  if (!workspace?.app_uuid) {
    return { error: 'Workspace not found.', status: 404 };
  }

  const { data: app, error: appError } = await supabase
    .from('apps')
    .select('id, is_active')
    .eq('id', workspace.app_uuid)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) {
    console.error('App lookup error:', appError);
    return { error: 'Unable to verify your store.', status: 500 };
  }

  if (!app || !app.is_active) {
    return { error: 'Store not found or inactive.', status: 403 };
  }

  return {
    supabase,
    appId: app.id
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendError(res, 405, 'Method not allowed.');
  }

  try {
    const context = await getStoreContext(req);

    if (context.error) {
      return sendError(res, context.status, context.error);
    }

    const { supabase, appId } = context;

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, app_id, title, content, created_at')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id ?? req.body?.id;

      if (!/^[0-9a-fA-F-]{1,64}$/.test(String(id ?? ''))) {
        return sendError(res, 400, 'A valid entry ID is required.');
      }

      const { data, error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id)
        .eq('app_id', appId)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        return sendError(res, 404, 'Entry not found.');
      }

      return res.status(200).json({ success: true });
    }

    const { title, content } = req.body || {};

    if (
      typeof title !== 'string' ||
      typeof content !== 'string'
    ) {
      return sendError(res, 400, 'Title and content are required.');
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (
      !cleanTitle ||
      cleanTitle.length > 200 ||
      !cleanContent ||
      cleanContent.length > 20000
    ) {
      return sendError(
        res,
        400,
        'Title or content is empty or exceeds the allowed length.'
      );
    }

    // The chatbot reads at most 50 entries per store.
    const { count: kbCount, error: countError } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', appId);

    if (countError) throw countError;

    if ((kbCount ?? 0) >= 50) {
      return sendError(res, 400, 'Knowledge base is full (50 entries). Delete an old entry first.');
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert([{
        app_id: appId,
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
    return sendError(
      res,
      500,
      'Unable to process the knowledge-base request.'
    );
  }
}
