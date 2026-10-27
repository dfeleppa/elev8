import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));
import { hasDevAuthBypass, isAuthPage, isFullyPublic, proxy } from "./proxy";

beforeEach(() => { vi.clearAllMocks(); getToken.mockResolvedValue(null); vi.stubEnv("DEV_AUTH_EMAIL", ""); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("proxy public route matching", () => {
  it("allows MCP and OAuth discovery endpoints without a logged-in browser session", () => {
    expect(isFullyPublic("/api/mcp/nutrition")).toBe(true);
    expect(isFullyPublic("/api/oauth/mcp/authorize")).toBe(true);
    expect(isFullyPublic("/.well-known/oauth-authorization-server")).toBe(true);
    expect(isFullyPublic("/.well-known/oauth-protected-resource/api/mcp/nutrition")).toBe(true);
  });
  it("keeps authentication pages reachable so stale sessions cannot cause a redirect loop", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/register")).toBe(true);
    expect(isAuthPage("/account-recovery")).toBe(true);
    expect(isAuthPage("/")).toBe(false);
  });
  it.each(["/login", "/account-recovery"])("does not inspect or redirect a session cookie on %s", async path => {
    const response = await proxy(new NextRequest(`https://app.daneff.com${path}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe("proxy dev auth bypass", () => {
  it("is only enabled in development when DEV_AUTH_EMAIL is set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_EMAIL", "dev.owner@lyfe.local");
    expect(hasDevAuthBypass()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(hasDevAuthBypass()).toBe(false);
  });
});

it.each(["/api/v1/session", "/api/v1/crm/contacts", "/api/garmin"])("lets %s perform its own authentication", async path => {
  const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { authorization: "Bearer mobile-token" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(getToken).not.toHaveBeenCalled();
});

it("continues protecting web pages and similar-looking paths", async () => {
  for (const path of ["/admin/crm", "/api/v10/private", "/account-recovery/private", "/api/garmin/private"]) {
    const response = await proxy(new NextRequest(`https://app.test${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  }
});

it.each(["/api/health-stats", "/api/owner/staff", "/api/owner/payroll", "/api/programming/week", "/api/athlete/consistency"])(
  "passes native requests to %s without requiring a browser cookie", async path => {
    const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { authorization: "Bearer mobile-token" } }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getToken).not.toHaveBeenCalled();
  },
);
it.each(["Bearer expired-token", "Bearer", "Basic invalid"])("leaves invalid authorization %j for the API auth gate", async authorization => {
  const response = await proxy(new NextRequest("https://app.test/api/health-stats", { headers: { authorization } }));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(getToken).not.toHaveBeenCalled();
});
it("does not let a bearer header bypass web page protection", async () => {
  for (const path of ["/owner/staff", "/member/workout", "/api-like/private"]) {
    const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { authorization: "Bearer mobile-token" } }));
    expect(response.status).toBe(307);
  }
});
it("lets only the exact signed SMS webhook bypass browser sessions", async () => {
  const allowed=await proxy(new NextRequest("https://app.test/api/webhooks/twilio/sms"));
  expect(allowed.headers.get("x-middleware-next")).toBe("1");
  expect(getToken).not.toHaveBeenCalled();
  const denied=await proxy(new NextRequest("https://app.test/api/webhooks/twilio/sms/private"));
  expect(denied.status).toBe(307);
});
