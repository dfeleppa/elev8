const LEGACY_HOSTS = new Set(["daneff.com", "www.daneff.com"]);
const CANONICAL_APP_URL = "https://app.daneff.com";

function normalizeUrl(value: string | null | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

export function getCanonicalAppUrl() {
  const configuredUrl =
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ?? normalizeUrl(process.env.NEXTAUTH_URL);

  if (!configuredUrl) {
    return CANONICAL_APP_URL;
  }

  if (LEGACY_HOSTS.has(configuredUrl.hostname)) {
    configuredUrl.hostname = "app.daneff.com";
    configuredUrl.protocol = "https:";
  }

  return configuredUrl.origin;
}

export function toCanonicalAppUrl(value: string) {
  const candidate = normalizeUrl(value);
  if (!candidate) {
    return new URL(value, getCanonicalAppUrl()).toString();
  }

  if (LEGACY_HOSTS.has(candidate.hostname)) {
    candidate.hostname = "app.daneff.com";
    candidate.protocol = "https:";
  }

  return candidate.toString();
}
