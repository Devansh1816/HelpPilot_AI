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
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
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
