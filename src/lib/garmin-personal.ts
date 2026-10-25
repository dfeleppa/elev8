import "server-only";
import { GarminError, garminEndpoint } from "./garmin-data";

const BASE = "https://personal.connectapi.garmin.com";
let cached: { key: string; value: string; expires: number } | undefined;
let pending: { key: string; promise: Promise<string> } | undefined;

export function garminMemberId() {
  return process.env.GARMIN_PERSONAL_MEMBER_ID?.trim() || "";
}

async function request(path: string, init: RequestInit) {
  try {
    return await fetch(BASE + path, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  } catch {
    throw new GarminError("Garmin could not be reached. Try again shortly.");
  }
}

async function boundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new GarminError("Garmin response is too large. Select fewer days.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof GarminError) throw error;
    throw new GarminError("Garmin response could not be read. Try again shortly.");
  } finally { reader.releaseLock(); }
}

async function token(rejectedToken?: string): Promise<string> {
  const key = process.env.GARMIN_PERSONAL_API_KEY?.trim();
  if (!key) throw new GarminError("Garmin Personal is not configured.", 503);
  if (cached?.key === key && cached.expires > Date.now() + 60000 && cached.value !== rejectedToken) return cached.value;
  if (pending?.key === key) return pending.promise;
  const promise = (async () => {
    const response = await request("/personalapitoken-service/personal-api/personal-api-key/token", {
      method: "POST", headers: { Authorization: `ApiKey ${key}`, Accept: "text/plain" },
    });
    if (response.status === 429) throw new GarminError("Garmin rate limit reached. Try again later.", 429);
    if (!response.ok) throw new GarminError("Garmin authentication failed. Check the Personal API key in Vercel.");
    // Garmin returns a plain-text JWT, not an OAuth JSON object.
    const value = (await boundedText(response, 16384)).trim();
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw new GarminError("Unexpected Garmin token response.");
    let expires = Date.now() + 300000;
    try {
      const exp: unknown = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString()).exp;
      if (typeof exp === "number" && Number.isFinite(exp)) expires = Math.min(exp * 1000, Date.now() + 23 * 3600000);
    } catch { /* Short cache lifetime for an opaque token. */ }
    cached = { key, value, expires };
    return value;
  })();
  const entry = { key, promise };
  pending = entry;
  try { return await promise; } finally { if (pending === entry) pending = undefined; }
}

export async function readGarmin(resource: string, params: URLSearchParams): Promise<unknown> {
  const path = garminEndpoint(resource, params);
  const accessToken = await token();
  const get = (value: string) => request(path, { headers: { Authorization: `Bearer ${value}`, Accept: "application/json" } });
  let response = await get(accessToken);
  if (response.status === 401) {
    await response.body?.cancel();
    response = await get(await token(accessToken));
  }
  if (response.status === 429) throw new GarminError("Garmin rate limit reached. Try again later.", 429);
  if (!response.ok) throw new GarminError("Garmin data is currently unavailable. Try again later.");
  if (response.status === 204) return null;
  const text = await boundedText(response, 1500000);
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new GarminError("Unexpected Garmin data response."); }
}
