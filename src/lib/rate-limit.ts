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

type HeaderLike = Headers | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderLike, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  // NextAuth's Credentials `req.headers` is a Record<string, string|string[]>.
  // Header lookups are case-insensitive in HTTP, so normalize.
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      if (Array.isArray(v)) return v[0] ?? null;
      return v ?? null;
    }
  }
  return null;
}

export function getClientIpFromHeaders(headers: HeaderLike): string {
  const forwarded = readHeader(headers, "x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return readHeader(headers, "x-real-ip")?.trim() || "unknown";
}

/** Check rate limit by an explicit key (e.g. an IP). */
export function rateLimitByKey(
  key: string,
  scope: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const composite = `${scope}:${key}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = (buckets.get(composite) ?? []).filter((t) => t > cutoff);

  if (bucket.length >= limit) {
    const oldest = bucket[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(composite, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.push(now);
  buckets.set(composite, bucket);

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

/** Convenience wrapper for fetch-style Request objects. */
export function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  return rateLimitByKey(
    getClientIpFromHeaders(request.headers),
    scope,
    limit,
    windowMs
  );
}
