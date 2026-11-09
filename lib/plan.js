// Shared plan logic.
// A store is "Pro" for 30 days after its latest approved payment (Rs 499/month).
// No extra database column is required.

export const FREE_TRIAL_CHAT_LIMIT = Number(
  process.env.FREE_TRIAL_CHAT_LIMIT || 100
);

const PRO_DAYS = 30;

export async function getPlanInfo(supabase, appUuid) {
  const { data, error } = await supabase
    .from('payments')
    .select('created_at')
    .eq('app_uuid', appUuid)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) return { plan: 'Free Trial', expiresAt: null };

  const expiresMs = new Date(data[0].created_at).getTime() + PRO_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() <= expiresMs
    ? { plan: 'Pro', expiresAt: new Date(expiresMs).toISOString() }
    : { plan: 'Free Trial', expiresAt: null };
}

// Kept for api/chat.js
export async function getPlan(supabase, appUuid) {
  return (await getPlanInfo(supabase, appUuid)).plan;
}
