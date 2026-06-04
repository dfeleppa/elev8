import { describe, expect, it } from "vitest";

import {
  isAuthorizedAgentBearerRequest,
  isAuthorizedAgentRequest,
  isAuthorizedAgentUrlTokenRequest,
} from "./agent-auth";

describe("agent auth helpers", () => {
  it("accepts the legacy x-agent-token header", () => {
    const request = new Request("https://app.daneff.com/api/mcp/nutrition", {
      headers: { "x-agent-token": "test-token" },
    });

    expect(isAuthorizedAgentRequest(request, "test-token")).toBe(true);
  });

  it("accepts bearer authorization", () => {
    const request = new Request("https://app.daneff.com/api/mcp/nutrition", {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(isAuthorizedAgentBearerRequest(request, "test-token")).toBe(true);
  });

  it("rejects URL token authentication", () => {
    const request = new Request("https://app.daneff.com/api/mcp/nutrition?agentToken=test-token");

    expect(isAuthorizedAgentUrlTokenRequest(request, "test-token")).toBe(false);
  });

  it("rejects common URL token aliases", () => {
    const request = new Request("https://app.daneff.com/api/mcp/nutrition?access_token=test-token");

    expect(isAuthorizedAgentUrlTokenRequest(request, "test-token")).toBe(false);
  });

  it("rejects URL token authentication when the token is wrong", () => {
    const request = new Request("https://app.daneff.com/api/mcp/nutrition?agentToken=wrong-token");

    expect(isAuthorizedAgentUrlTokenRequest(request, "test-token")).toBe(false);
  });
});
