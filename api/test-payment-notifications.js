import { createClient } from '@supabase/supabase-js';
import { sendAdminNotification, sendStoreNotification } from '../lib/email.js';

// This endpoint exists only for safe Preview verification. It never creates or
// updates payment records and cannot run in Production.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  if (process.env.VERCEL_ENV !== 'preview') {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerUserId = process.env.OWNER_USER_ID;

  if (!url || !anonKey || !serviceKey || !ownerUserId) {
    return res.status(500).json({ success: false, error: 'Server configuration error.' });
  }

  const token = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  try {
    const authClient = createClient(url, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);

    if (authError || !authData?.user || authData.user.id !== ownerUserId) {
      return res.status(403).json({ success: false, error: 'Admin access required.' });
    }

    const appId = req.body?.app_id;
    if (typeof appId !== 'string' || !/^[0-9a-f-]{36}$/i.test(appId)) {
      return res.status(400).json({ success: false, error: 'A valid public app ID is required.' });
    }

    const supabase = createClient(url, serviceKey);
    const { data: app, error: appError } = await supabase
      .from('apps')
      .select('id, public_app_id')
      .eq('public_app_id', appId)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return res.status(404).json({ success: false, error: 'Test store not found.' });

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('user_id, store_name')
      .eq('app_uuid', app.id)
      .maybeSingle();

    if (workspaceError) throw workspaceError;
    if (!workspace?.user_id) {
      return res.status(404).json({ success: false, error: 'Store owner not found.' });
    }

    const { data: ownerData, error: ownerError } =
      await supabase.auth.admin.getUserById(workspace.user_id);

    if (ownerError || !ownerData?.user?.email) {
      return res.status(404).json({ success: false, error: 'Store owner email not found.' });
    }

    const common = {
      storeName: workspace.store_name,
      appId: app.public_app_id,
      details: 'Preview-only notification test. No payment was submitted, approved, or rejected.'
    };

    const results = await Promise.all([
      sendAdminNotification({
        ...common,
        subject: 'HelpPilot AI test: payment submitted',
        eventType: 'payment_submitted'
      }),
      sendStoreNotification(ownerData.user.email, {
        ...common,
        subject: 'HelpPilot AI test: payment approved',
        eventType: 'payment_approved'
      }),
      sendStoreNotification(ownerData.user.email, {
        ...common,
        subject: 'HelpPilot AI test: payment rejected',
        eventType: 'payment_rejected'
      })
    ]);

    return res.status(200).json({
      success: results.every(result => result.sent),
      previewOnly: true,
      databaseChanged: false,
      notifications: {
        adminPaymentSubmitted: results[0],
        ownerPaymentApproved: results[1],
        ownerPaymentRejected: results[2]
      }
    });
  } catch (error) {
    console.error('Preview payment notification test failed:', error?.name || 'unknown_error');
    return res.status(500).json({ success: false, error: 'Unable to run notification test.' });
  }
}
