import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ownerUserId = process.env.OWNER_USER_ID || '';

    if (!url || !anonKey || !serviceRoleKey) {
      return res.status(500).json({ success: false, error: 'Server configuration error.' });
    }

    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const authClient = createClient(url, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session.' });
    }

    const supabase = createClient(url, serviceRoleKey);
    const userId = authData.user.id;
    const isPlatformAdmin = Boolean(ownerUserId && userId === ownerUserId);

    let query = supabase.from('conversations').select('id', { count: 'exact', head: true });
    let escalationQuery = supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'escalated');

    if (!isPlatformAdmin) {
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces').select('app_uuid').eq('user_id', userId).maybeSingle();
      if (workspaceError) throw workspaceError;
      if (!workspace?.app_uuid) return res.status(404).json({ success: false, error: 'Workspace not found.' });

      const { data: app, error: appError } = await supabase
        .from('apps').select('id, is_active').eq('id', workspace.app_uuid).eq('user_id', userId).maybeSingle();
      if (appError) throw appError;
      if (!app || !app.is_active) return res.status(403).json({ success: false, error: 'Store not found or inactive.' });

      query = query.eq('app_uuid', app.id);
      escalationQuery = escalationQuery.eq('app_uuid', app.id);
    }

    const [{ count: total, error: totalError }, { count: escalations, error: escalationError }] =
      await Promise.all([query, escalationQuery]);
    if (totalError) throw totalError;
    if (escalationError) throw escalationError;

    const totalConversations = total ?? 0;
    const escalationCount = escalations ?? 0;
    const resolved = Math.max(0, totalConversations - escalationCount);
    const resolutionRate = totalConversations === 0 ? '0%' : `${((resolved / totalConversations) * 100).toFixed(1)}%`;

    return res.status(200).json({
      success: true, totalConversations, resolutionRate, escalations: escalationCount
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ success: false, error: 'Unable to load analytics.' });
  }
}
