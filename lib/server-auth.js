
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerUserId = process.env.OWNER_USER_ID;

export async function verifyOwner(req) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !ownerUserId) {
    return {
      ok: false,
      status: 500,
      error: 'Server authentication is not configured.'
    };
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required.'
    };
  }

  const authClient = createClient(supabaseUrl, anonKey);

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid or expired session.'
    };
  }

  if (data.user.id !== ownerUserId) {
    return {
      ok: false,
      status: 403,
      error: 'Access denied.'
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  return {
    ok: true,
    user: data.user,
    supabase: adminClient
  };
}
