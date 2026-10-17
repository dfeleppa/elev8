/** Default off. Hosted production and the known live database are explicitly excluded. */
export function memberScheduleEnabled(): boolean {
  if (process.env.MEMBER_SCHEDULE_ENABLED !== "true" || process.env.VERCEL_ENV === "production") return false;
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return false;
  try {
    const url = new URL(value);
    const environment = process.env.MEMBER_SCHEDULE_ENVIRONMENT;
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
