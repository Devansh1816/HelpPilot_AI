import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({
      success: false,
      error: 'Method not allowed.'
    });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ownerUserId = process.env.OWNER_USER_ID;

    if (!url || !anonKey || !serviceKey || !ownerUserId) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error.'
      });
    }

    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const authClient = createClient(url, anonKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session.'
      });
    }

    const user = authData.user;
    const isOwner = user.id === ownerUserId;
    const supabase = createClient(url, serviceKey);

    // Verify store ownership for normal users.
    let app = null;

    if (!isOwner) {
      const { data: workspace, error: workspaceError } =
        await supabase
          .from('workspaces')
          .select('app_uuid')
          .eq('user_id', user.id)
          .maybeSingle();

      if (workspaceError) throw workspaceError;

      if (!workspace?.app_uuid) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found.'
        });
      }

      const { data, error } = await supabase
        .from('apps')
        .select('id, public_app_id, is_active')
        .eq('id', workspace.app_uuid)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data || !data.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Store not found or inactive.'
        });
      }

      app = data;
    }

    // GET: Store owners see their payments; admin sees all.
    if (req.method === 'GET') {
      let query = supabase
        .from('payments')
        .select('id, app_id, utr_number, status, created_at')
        .order('created_at', { ascending: false });

      if (!isOwner) {
        query = query.eq('app_uuid', app.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || []
      });
    }

    // POST: Store owner submits a payment reference.
    if (req.method === 'POST') {
      if (isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Admin accounts cannot submit store payments.'
        });
      }

      const { utr_number } = req.body || {};

      if (
        typeof utr_number !== 'string' ||
        !/^[a-zA-Z0-9-]{6,40}$/.test(utr_number.trim())
      ) {
        return res.status(400).json({
          success: false,
          error: 'Enter a valid payment reference.'
        });
      }

      const { data, error } = await supabase
        .from('payments')
        .insert([{
          app_id: app.public_app_id,
          app_uuid: app.id,
          utr_number: utr_number.trim(),
          status: 'pending'
        }])
        .select('id, app_id, utr_number, status, created_at')
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        data
      });
    }

    // PATCH: Only the main admin can approve or reject payments.
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required.'
      });
    }

    const { id, status } = req.body || {};

    if (
      !Number.isSafeInteger(Number(id)) ||
      Number(id) <= 0 ||
      !['approved', 'rejected'].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        error: 'A valid payment ID and status are required.'
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({ status })
      .eq('id', Number(id))
      .eq('status', 'pending')
      .select('id, app_id, utr_number, status, created_at')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Pending payment not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Payments API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Unable to process payment request.'
    });
  }
}
