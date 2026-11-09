// Shared plan logic.
// A store is "Pro" for 30 days per approved payment (Rs 99/month),
// counted from the approval time. Renewals stack: paying early extends the
// current expiry instead of resetting it.
// Requires the payments.approved_at column (see SQL in the instructions).

export const FREE_TRIAL_CHAT_LIMIT = Number(
  process.env.FREE_TRIAL_CHAT_LIMIT || 100
);

// Single source of truth for pricing.
export const PRO_PRICE_INR = 99;
export const PRO_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getPlanInfo(supabase, appUuid) {
  const { data, error } = await supabase
    .from('payments')
    .select('approved_at, created_at')
    .eq('app_uuid', appUuid)
    .eq('status', 'approved')
    .limit(200);

  if (error) throw error;

  if (!data || data.length === 0) {
    return { plan: 'Free Trial', expiresAt: null };
  }

  // Use approval time; old rows without it fall back to created_at.
  const approvals = data
    .map(p => new Date(p.approved_at || p.created_at).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  // Walk payments oldest to newest. Each one adds PRO_DAYS on top of the
  // current expiry if still active, otherwise from its own approval time.
  let expiresMs = 0;
  for (const approvedMs of approvals) {
    expiresMs = Math.max(expiresMs, approvedMs) + PRO_DAYS * DAY_MS;
  }

  return Date.now() <= expiresMs
    ? { plan: 'Pro', expiresAt: new Date(expiresMs).toISOString() }
    : { plan: 'Free Trial', expiresAt: null };
}

// Kept for api/chat.js
export async function getPlan(supabase, appUuid) {
  return (await getPlanInfo(supabase, appUuid)).plan;
}
