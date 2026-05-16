import { describe, expect, it } from "vitest";

import { isFullyPublic } from "./proxy";

describe("proxy public route matching", () => {
  it("allows MCP and OAuth discovery endpoints without a logged-in browser session", () => {
    expect(isFullyPublic("/api/mcp/nutrition")).toBe(true);
    expect(isFullyPublic("/api/oauth/mcp/authorize")).toBe(true);
    expect(isFullyPublic("/.well-known/oauth-authorization-server")).toBe(true);
    expect(isFullyPublic("/.well-known/oauth-protected-resource/api/mcp/nutrition")).toBe(true);
  });
});
