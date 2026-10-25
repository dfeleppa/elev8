import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const params = () => new URLSearchParams({ start_date: "2026-10-24", end_date: "2026-10-24" });
const jwt = (suffix = "signature") => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url")}.${suffix}`;

describe("Garmin Personal transport", () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv("GARMIN_PERSONAL_API_KEY", "test-key"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("exchanges a plain-text JWT once for concurrent requests and never sends the key to data endpoints", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.cache).toBe("no-store"); expect(init.redirect).toBe("error");
      if (url.includes("personal-api-key/token")) {
        expect(init.headers).toMatchObject({ Authorization: "ApiKey test-key" });
        return new Response(jwt());
      }
      expect(init.headers).toMatchObject({ Authorization: `Bearer ${jwt()}` });
      return Response.json({ data: [] });
    });
    vi.stubGlobal("fetch", fetcher);
    const { readGarmin } = await import("./garmin-personal");
    await Promise.all([readGarmin("daily", params()), readGarmin("sleep", params())]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("refreshes a rejected token once, then stops on repeated rejection", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(jwt())).mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(jwt("second"))).mockResolvedValueOnce(new Response("private provider error", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const { readGarmin } = await import("./garmin-personal");
    await expect(readGarmin("daily", params())).rejects.toThrow("Garmin data is currently unavailable");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("fails closed when the key is missing and validates before making requests", async () => {
    vi.stubEnv("GARMIN_PERSONAL_API_KEY", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { readGarmin } = await import("./garmin-personal");
    await expect(readGarmin("daily", params())).rejects.toMatchObject({ status: 503 });
    await expect(readGarmin("arbitrary", params())).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves no data and propagates rate limits without leaking upstream bodies", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(jwt())).mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("secret", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const { readGarmin } = await import("./garmin-personal");
    expect(await readGarmin("daily", params())).toBeNull();
    await expect(readGarmin("daily", params())).rejects.toMatchObject({ status: 429 });
  });
  it("rejects malformed token and JSON responses", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ access_token: jwt() }))
      .mockResolvedValueOnce(new Response(jwt())).mockResolvedValueOnce(new Response("<html>error</html>"));
    vi.stubGlobal("fetch", fetcher);
    const { readGarmin } = await import("./garmin-personal");
    await expect(readGarmin("daily", params())).rejects.toThrow("Unexpected Garmin token");
    await expect(readGarmin("daily", params())).rejects.toThrow("Unexpected Garmin data");
  });
});
