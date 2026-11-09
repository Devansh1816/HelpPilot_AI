// Lightweight in-memory limiter (per serverless instance).
// It slows down simple abuse; the database-backed per-store cap in
// api/chat.js is the hard limit that works across all instances.

const buckets = new Map();

export function hitLimit(key, max, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter(t => now - t < windowMs);

  if (recent.length >= max) {
    buckets.set(key, recent);
    return true;
  }

  recent.push(now);
  buckets.set(key, recent);

  // Prevent unbounded memory growth.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }

  return false;
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
