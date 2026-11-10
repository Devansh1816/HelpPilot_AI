import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminUserId = process.env.OWNER_USER_ID || '';

    if (!url || !anonKey || !serviceKey || !adminUserId) {
      return res.status(500).json({ success: false, error: 'Admin service is not configured.' });
    }

    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const authClient = createClient(url, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session.' });
    }
    if (authData.user.id !== adminUserId) {
      return res.status(403).json({ success: false, error: 'Platform administrator access required.' });
    }

    const db = createClient(url, serviceKey);

    if (req.method === 'PATCH') {
      const { appId, is_active } = req.body || {};
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (typeof appId !== 'string' || !uuidPattern.test(appId) || typeof is_active !== 'boolean') {
        return res.status(400).json({ success: false, error: 'A valid app ID and boolean status are required.' });
      }

      const { data, error } = await db.from('apps')
        .update({ is_active })
        .eq('id', appId)
        .select('id, app_name, is_active')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Store not found.' });

      return res.status(200).json({ success: true, data });
    }

    const [{ data: workspaces, error: workspaceError }, { data: apps, error: appsError }] =
      await Promise.all([
        db.from('workspaces')
          .select('user_id, store_name, plan_type, plan_expires_at, app_uuid, created_at')
          .order('created_at', { ascending: false }),
        db.from('apps')
          .select('id, user_id, app_name, domain, public_app_id, is_active, created_at')
      ]);
    if (workspaceError) throw workspaceError;
    if (appsError) throw appsError;

    const appById = new Map((apps || []).map(app => [app.id, app]));
    const rows = await Promise.all((workspaces || []).map(async workspace => {
      const app = appById.get(workspace.app_uuid);
      if (!app) return null;

      const [
        { count: conversations, error: conversationsError },
        { count: knowledgeEntries, error: knowledgeError },
        { count: paymentSubmissions, error: paymentsError },
        { data: ownerData, error: ownerError }
      ] = await Promise.all([
        db.from('conversations').select('id', { count: 'exact', head: true }).eq('app_uuid', app.id),
        db.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('app_id', app.id),
        db.from('payments').select('id', { count: 'exact', head: true }).eq('app_uuid', app.id),
        db.auth.admin.getUserById(workspace.user_id)
      ]);
      if (conversationsError) throw conversationsError;
      if (knowledgeError) throw knowledgeError;
      if (paymentsError) throw paymentsError;
      if (ownerError) throw ownerError;

      return {
        app_uuid: app.id,
        public_app_id: app.public_app_id,
        store_name: workspace.store_name || app.app_name,
        app_name: app.app_name,
        owner_email: ownerData?.user?.email || null,
        domain: app.domain || null,
        is_active: Boolean(app.is_active),
        plan_type: workspace.plan_type || 'Free Trial',
        plan_expires_at: workspace.plan_expires_at || null,
        created_at: workspace.created_at || app.created_at,
        conversations: conversations || 0,
        knowledge_entries: knowledgeEntries || 0,
        payment_submissions: paymentSubmissions || 0
      };
    }));

    const stores = rows.filter(Boolean);
    const summary = stores.reduce((total, store) => {
      total.stores += 1;
      total.activeStores += store.is_active ? 1 : 0;
      total.conversations += store.conversations;
      total.knowledgeEntries += store.knowledge_entries;
      return total;
    }, { stores: 0, activeStores: 0, conversations: 0, knowledgeEntries: 0 });

    return res.status(200).json({ success: true, summary, data: stores });
  } catch (error) {
    console.error('Admin stores API error:', error);
    return res.status(500).json({ success: false, error: 'Unable to load store management data.' });
  }
}
