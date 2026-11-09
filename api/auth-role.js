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
    const ownerUserId = process.env.OWNER_USER_ID;

    if (!url || !anonKey || !ownerUserId) {
      return res.status(500).json({
        success: false,
        error: 'Authentication configuration error.'
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

    const supabase = createClient(url, anonKey);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session.'
      });
    }

    return res.status(200).json({
      success: true,
      isOwner: data.user.id === ownerUserId
    });

  } catch (error) {
    console.error('Auth role API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Unable to verify account role.'
    });
  }
}
