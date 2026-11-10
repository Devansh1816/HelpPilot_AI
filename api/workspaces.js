import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { getPlanInfo } from '../lib/plan.js';
import { sendAdminNotification, sendWelcomeEmail } from '../lib/email.js';

// Turns "https://www.MyShop.com/products?x=1" into "myshop.com".
// Returns '' if the value is not a valid website domain.
// Must stay compatible with normalizeHost() in api/chat.js.
function normalizeDomain(value) {
  if (typeof value !== 'string') return '';

  const raw = value.trim();
  if (!raw || raw.length > 253) return '';

  let host = '';
  try {
    host = new URL(raw.includes('://') ? raw : `https://${raw}`)
      .hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }

  // localhost is allowed so owners can test; everything else needs a real
  // domain like "myshop.com" or "shop.myshop.co.in".
  if (host === 'localhost') return host;

  const validHost =
    /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);

  return validHost ? host : '';
}

const DOMAIN_ERROR =
  'Enter a valid website domain, for example myshop.com.';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({
      error: 'Server configuration error.'
    });
  }

  const token = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.'
    });
  }

  try {
    const authClient = createClient(url, anonKey);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'Invalid or expired session.'
      });
    }

    const user = authData.user;
    const admin = createClient(url, serviceKey);

    const { data: existing, error: lookupError } = await admin
      .from('workspaces')
      .select('id, app_id, app_uuid, store_name')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    // GET: Retrieve the existing workspace.
    if (req.method === 'GET') {
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'No workspace found for this account.'
        });
      }

      if (!existing.app_uuid) {
        return res.status(409).json({
          error: 'Workspace has no verified app mapping.'
        });
      }

      const { data: app, error: appError } = await admin
        .from('apps')
        .select('public_app_id, is_active, domain')
        .eq('id', existing.app_uuid)
        .eq('user_id', user.id)
        .maybeSingle();

      if (appError) throw appError;

      if (!app || !app.public_app_id) {
        return res.status(409).json({
          error: 'Workspace app mapping is incomplete.'
        });
      }

      if (!app.is_active) {
        return res.status(403).json({
          error: 'This application is inactive.'
        });
      }

      const { plan, expiresAt } = await getPlanInfo(admin, existing.app_uuid);

      return res.status(200).json({
        success: true,
        workspace: { ...existing, plan_type: plan, plan_expires_at: expiresAt },
        publicAppId: app.public_app_id,
        domain: app.domain || null
      });
    }

    // PATCH: Set or change the website domain allowed to use the chatbot.
    if (req.method === 'PATCH') {
      if (!existing?.app_uuid) {
        return res.status(404).json({
          error: 'No workspace found for this account.'
        });
      }

      const domain = normalizeDomain(req.body?.domain);

      if (!domain) {
        return res.status(400).json({ error: DOMAIN_ERROR });
      }

      const { data: updated, error: updateError } = await admin
        .from('apps')
        .update({ domain })
        .eq('id', existing.app_uuid)
        .eq('user_id', user.id)
        .select('domain')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updated) {
        return res.status(404).json({ error: 'Store not found.' });
      }

      return res.status(200).json({
        success: true,
        domain: updated.domain
      });
    }

    // POST: Create a workspace if one does not exist.
    if (existing) {
      if (!existing.app_uuid) {
        return res.status(409).json({
          error: 'Workspace has no verified app mapping.'
        });
      }

      const { data: app, error: appError } = await admin
        .from('apps')
        .select('public_app_id, is_active, domain')
        .eq('id', existing.app_uuid)
        .eq('user_id', user.id)
        .maybeSingle();

      if (appError) throw appError;

      if (!app || !app.public_app_id) {
        return res.status(409).json({
          error: 'Workspace app mapping is incomplete.'
        });
      }

      if (!app.is_active) {
        return res.status(403).json({
          error: 'This application is inactive.'
        });
      }

      const { plan, expiresAt } = await getPlanInfo(admin, existing.app_uuid);

      return res.status(200).json({
        success: true,
        workspace: { ...existing, plan_type: plan, plan_expires_at: expiresAt },
        publicAppId: app.public_app_id,
        domain: app.domain || null,
        alreadyExists: true
      });
    }

    const storeName =
      typeof req.body?.storeName === 'string'
        ? req.body.storeName.trim()
        : '';

    if (!storeName || storeName.length > 100) {
      return res.status(400).json({
        error: 'Enter a valid store name.'
      });
    }

    // Domain is required: the chat API refuses stores without one.
    const domain = normalizeDomain(req.body?.domain);

    if (!domain) {
      return res.status(400).json({ error: DOMAIN_ERROR });
    }

    const appId = `store_${randomUUID()}`;
    const publicAppId = randomUUID();

    const { data: app, error: appError } = await admin
      .from('apps')
      .insert({
        app_name: storeName,
        user_id: user.id,
        public_app_id: publicAppId,
        domain,
        is_active: true
      })
      .select('id')
      .single();

    if (appError) throw appError;

    const { data: workspace, error: workspaceError } = await admin
      .from('workspaces')
      .insert({
        user_id: user.id,
        app_id: appId,
        app_uuid: app.id,
        store_name: storeName
      })
      .select('id, app_id, app_uuid, store_name')
      .single();

    if (workspaceError) {
      const { error: cleanupError } = await admin
        .from('apps')
        .delete()
        .eq('id', app.id)
        .eq('user_id', user.id);

      if (cleanupError) {
        console.error('App cleanup failed:', cleanupError);
      }

      throw workspaceError;
    }

    // Best-effort transactional emails; provider failures must not undo signup.
    await sendWelcomeEmail(
      user.email,
      user.user_metadata?.full_name || user.user_metadata?.name || storeName,
      publicAppId
    );

    await sendAdminNotification({
      subject: 'New HelpPilot AI registration',
      eventType: 'new_registration',
      storeName,
      appId: publicAppId,
      details: 'A new store workspace was created.'
    });

    return res.status(201).json({
      success: true,
      workspace: { ...workspace, plan_type: 'Free Trial', plan_expires_at: null },
      publicAppId,
      domain
    });

  } catch (error) {
    console.error('Workspace API error:', error);

    return res.status(500).json({
      error: 'Unable to process workspace request.'
    });
  }
}
