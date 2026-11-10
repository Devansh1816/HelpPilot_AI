import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
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

        // OWNER_USER_ID is only needed to grant platform-admin visibility.
        // Store owners must still be able to view their own conversations
        // when the optional platform-admin ID is not configured.
        if (!url || !anonKey || !serviceKey) {
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
        const isOwner = Boolean(ownerUserId && user.id === ownerUserId);
        const admin = createClient(url, serviceKey);

        let query = admin
            .from('conversations')
            .select('id, app_id, visitor_id, status, created_at, message')
            .order('created_at', { ascending: false })
            .limit(50);

        // Non-admin store owners can only see their own verified app.
        if (!isOwner) {
            const { data: workspace, error: workspaceError } = await admin
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

            const { data: app, error: appError } = await admin
                .from('apps')
                .select('id, is_active')
                .eq('id', workspace.app_uuid)
                .eq('user_id', user.id)
                .maybeSingle();

            if (appError) throw appError;

            if (!app || !app.is_active) {
                return res.status(403).json({
                    success: false,
                    error: 'Store not found or inactive.'
                });
            }

            query = query.eq('app_uuid', app.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Conversations API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Unable to load conversations.'
        });
    }
}
