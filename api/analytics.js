
import { verifyOwner } from '../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      error: 'Method not allowed.'
    });
  }

  const auth = await verifyOwner(req);

  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      error: auth.error
    });
  }

  try {
    const { count: total, error: totalError } = await auth.supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true });

    if (totalError) throw totalError;

    const { count: escalations, error: escalationError } =
      await auth.supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'escalated');

    if (escalationError) throw escalationError;

    const totalConversations = total ?? 0;
    const escalationCount = escalations ?? 0;
    const resolved = Math.max(0, totalConversations - escalationCount);

    const resolutionRate = totalConversations === 0
      ? '0%'
      : `${((resolved / totalConversations) * 100).toFixed(1)}%`;

    return res.status(200).json({
      success: true,
      totalConversations,
      resolutionRate,
      escalations: escalationCount
    });

  } catch (error) {
    console.error('Analytics API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Unable to load analytics.'
    });
  }
}
