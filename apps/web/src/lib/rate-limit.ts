type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

const buckets = new Map<string, Bucket>();
const DEFAULT_MAX_BUCKETS = 5_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function readMaxBuckets() {
  const parsed = Number(process.env.RATE_LIMIT_MAX_BUCKETS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BUCKETS;
}

function cleanupBuckets(now: number, maxBuckets = readMaxBuckets()) {
  if (buckets.size < maxBuckets && now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size > maxBuckets) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

function pruneOverflow() {
  const maxBuckets = readMaxBuckets();
  while (buckets.size > maxBuckets) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

function getSharedStoreConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

function normalizeSharedKey(key: string) {
  return `recalc:rate-limit:${Buffer.from(key).toString("base64url")}`;
}

async function checkSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const config = getSharedStoreConfig();
  if (!config) return checkInMemoryRateLimit(key, { limit, windowMs });

  try {
    const redisKey = normalizeSharedKey(key);
    const response = await fetch(`${config.url}/multi-exec`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["SET", redisKey, "0", "PX", Math.max(1, Math.ceil(windowMs)), "NX"],
        ["INCR", redisKey],
        ["PTTL", redisKey],
      ]),
    });

    if (!response.ok) return { ok: false, retryAfterMs: 1_000 };

    const payload = (await response.json()) as Array<{
      result?: number | string | null;
      error?: string;
    }>;
    if (payload.some((entry) => entry.error)) {
      return { ok: false, retryAfterMs: 1_000 };
    }

    const count = Number(payload[1]?.result);
    if (!Number.isFinite(count)) return { ok: false, retryAfterMs: 1_000 };

    if (count > limit) {
      const ttl = Number(payload[2]?.result);
      return {
        ok: false,
        retryAfterMs: Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs,
      };
    }

    return { ok: true, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: false, retryAfterMs: 1_000 };
  }
}

function checkInMemoryRateLimit(
  key: string,
  options?: { limit?: number; windowMs?: number }
): RateLimitResult {
  const limit = options?.limit ?? 5;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  cleanupBuckets(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    pruneOverflow();
    return { ok: true as const, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return {
      ok: false as const,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  buckets.set(key, current);
  pruneOverflow();
  return { ok: true as const, remaining: Math.max(0, limit - current.count) };
}

export function checkRateLimit(
  key: string,
  options?: { limit?: number; windowMs?: number },
) {
  const limit = options?.limit ?? 5;
  const windowMs = options?.windowMs ?? 60_000;
  return checkSharedRateLimit(key, limit, windowMs);
}

export function __getRateLimitBucketCountForTests() {
  return buckets.size;
}

export function __resetRateLimitForTests() {
  buckets.clear();
  lastCleanupAt = 0;
}
