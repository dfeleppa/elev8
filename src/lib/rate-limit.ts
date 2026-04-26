/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks per-key timestamps in a Map and prunes them lazily. This is a
 * per-instance limit — on Vercel, each warm function instance keeps its own
 * Map. That makes it imperfect against a distributed attacker, but still
 * blocks the common cases (single-source brute force, accidental client
 * loops) without adding a Redis or DB dependency.
 *
 * For traffic levels that warrant stronger guarantees, swap this for a
 * Redis/Upstash-backed implementation.
 */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const ip = getClientIp(request);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (bucket.length >= limit) {
    const oldest = bucket[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.push(now);
  buckets.set(key, bucket);

  // Periodic cleanup so the Map doesn't grow unbounded over a long-lived
  // function instance.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        buckets.delete(k);
      } else if (fresh.length !== v.length) {
        buckets.set(k, fresh);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
