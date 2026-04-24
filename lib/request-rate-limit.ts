type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function getRequestIdentity(userId: string | null, forwardedFor: string | null, userAgent: string | null) {
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown-ip";
  const ua = (userAgent || "unknown-ua").slice(0, 120);
  return userId ? `user:${userId}` : `anon:${ip}:${ua}`;
}

