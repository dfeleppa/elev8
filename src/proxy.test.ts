import { afterEach, describe, expect, it, vi } from "vitest";

import { hasDevAuthBypass, isFullyPublic } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy public route matching", () => {
  it("allows MCP and OAuth discovery endpoints without a logged-in browser session", () => {
    expect(isFullyPublic("/api/mcp/nutrition")).toBe(true);
    expect(isFullyPublic("/api/oauth/mcp/authorize")).toBe(true);
    expect(isFullyPublic("/.well-known/oauth-authorization-server")).toBe(true);
    expect(isFullyPublic("/.well-known/oauth-protected-resource/api/mcp/nutrition")).toBe(true);
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
