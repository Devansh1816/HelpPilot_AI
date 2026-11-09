import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { getPlanInfo } from '../lib/plan.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
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
        .select('public_app_id, is_active')
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
        publicAppId: app.public_app_id
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
        .select('public_app_id, is_active')
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

    const appId = `store_${randomUUID()}`;
    const publicAppId = randomUUID();

    const { data: app, error: appError } = await admin
      .from('apps')
      .insert({
        app_name: storeName,
        user_id: user.id,
        public_app_id: publicAppId,
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

    return res.status(201).json({
      success: true,
      workspace: { ...workspace, plan_type: 'Free Trial', plan_expires_at: null },
      publicAppId
    });

  } catch (error) {
    console.error('Workspace API error:', error);

    return res.status(500).json({
      error: 'Unable to process workspace request.'
    });
  }
}
