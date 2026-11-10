import { createClient } from '@supabase/supabase-js';
import { sendAdminNotification, sendStoreNotification } from '../lib/email.js';

const PAYMENT_COLUMNS = 'id, app_id, utr_number, status, created_at, approved_at';

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
    let storeName = null;

    if (!isOwner) {
      const { data: workspace, error: workspaceError } =
        await supabase
          .from('workspaces')
          .select('app_uuid, store_name')
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
      storeName = workspace.store_name || null;
    }

    // GET: Store owners see their payments; admin sees all.
    if (req.method === 'GET') {
      let query = supabase
        .from('payments')
        .select(PAYMENT_COLUMNS)
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

      const cleanUtr = utr_number.trim();

      // Reject a reference that has already been submitted by anyone.
      const { data: dup, error: dupError } = await supabase
        .from('payments')
        .select('id')
        .ilike('utr_number', cleanUtr)
        .limit(1);

      if (dupError) throw dupError;

      if (dup && dup.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'This payment reference has already been submitted.'
        });
      }

      // Limit spam: at most 3 pending submissions per store.
      const { count: pendingCount, error: pendingError } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('app_uuid', app.id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      if ((pendingCount ?? 0) >= 3) {
        return res.status(429).json({
          success: false,
          error: 'You already have pending payments awaiting review.'
        });
      }

      const { data, error } = await supabase
        .from('payments')
        .insert([{
          app_id: app.public_app_id,
          app_uuid: app.id,
          utr_number: cleanUtr,
          status: 'pending'
        }])
        .select(PAYMENT_COLUMNS)
        .single();

      // 23505 = unique violation (two identical submissions at the same moment)
      if (error?.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'This payment reference has already been submitted.'
        });
      }

      if (error) throw error;

      // Email is best-effort: a notification failure must not make a
      // successfully saved payment submission appear to have failed.
      try {
        await sendAdminNotification({
          subject: 'New HelpPilot AI payment reference',
          eventType: 'payment_submitted',
          storeName: storeName || 'Store name unavailable',
          appId: app.public_app_id,
          details: 'A store submitted a payment reference. Review it in the admin dashboard; verify payment independently before approval.'
        });
      } catch (notificationError) {
        console.error('Payment submission notification failed:', notificationError?.name || 'unknown_error');
      }

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

    // Approval time starts the 30-day subscription (read by lib/plan.js).
    const update = { status };
    if (status === 'approved') {
      update.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('payments')
      .update(update)
      .eq('id', Number(id))
      .eq('status', 'pending')
      .select(PAYMENT_COLUMNS)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Pending payment not found.'
      });
    }

    // Notification processing is isolated after the payment state change.
    // It must never make a completed approval/rejection appear to have failed.
    try {
      const { data: paymentOwner } = await supabase
        .from('payments')
        .select('app_uuid')
        .eq('id', data.id)
        .maybeSingle();

      const { data: workspace } = paymentOwner?.app_uuid
        ? await supabase
            .from('workspaces')
            .select('user_id, store_name')
            .eq('app_uuid', paymentOwner.app_uuid)
            .maybeSingle()
        : { data: null };

      if (workspace?.user_id) {
        const { data: ownerData } = await supabase.auth.admin.getUserById(workspace.user_id);
        await sendStoreNotification(ownerData?.user?.email, {
          subject: `HelpPilot AI payment ${status}`,
          eventType: `payment_${status}`,
          storeName: workspace.store_name,
          appId: data.app_id,
          details: `Your payment reference was ${status}. Please check your dashboard for details.`
        });
      }
    } catch (notificationError) {
      console.error('Payment decision notification failed:', notificationError?.name || 'unknown_error');
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
