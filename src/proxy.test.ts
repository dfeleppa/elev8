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
    expect(isAuthPage("/")).toBe(false);
  });
  it("does not inspect or redirect a session cookie on the login page", async () => {
    const response = await proxy(new NextRequest("https://app.daneff.com/login"));
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

it.each(["/api/v1/session", "/api/v1/crm/contacts"])("lets %s perform its own bearer authentication", async path => {
  const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { authorization: "Bearer mobile-token" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(getToken).not.toHaveBeenCalled();
});

it("continues protecting web pages and similar-looking paths", async () => {
  for (const path of ["/admin/crm", "/api/v10/private"]) {
    const response = await proxy(new NextRequest(`https://app.test${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  }
});
