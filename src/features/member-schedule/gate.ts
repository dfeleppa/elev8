/** Default off. Every enabled environment pins its exact database target. */
export function memberScheduleEnabled(): boolean {
  if (process.env.MEMBER_SCHEDULE_ENABLED !== "true") return false;
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return false;
  try {
    const url = new URL(value);
    const environment = process.env.MEMBER_SCHEDULE_ENVIRONMENT;
    if (process.env.VERCEL_ENV === "production" || environment === "production") {
      const reference = process.env.MEMBER_SCHEDULE_PRODUCTION_PROJECT_REF;
      return process.env.VERCEL_ENV === "production" && environment === "production"
        && reference === "scghaxpgsibpffbukyws"
        && url.protocol === "https:" && url.hostname === reference + ".supabase.co"
        && url.pathname === "/" && !url.port && !url.username && !url.password && !url.search && !url.hash;
    }
    if (environment === "test") {
      return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "55321";
    }
    // Pin the intended isolated project explicitly; a generic Preview environment is insufficient.
    const reference = process.env.MEMBER_SCHEDULE_STAGING_PROJECT_REF;
    return environment === "staging" && Boolean(reference && /^[a-z0-9]{20}$/.test(reference))
      && reference !== "scghaxpgsibpffbukyws"
      && url.protocol === "https:" && url.hostname === reference + ".supabase.co"
      && url.pathname === "/" && !url.port && !url.username && !url.password;
  } catch { return false; }
}
