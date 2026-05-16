import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/nutrition-mcp", () => ({
  createNutritionMcpServer: vi.fn(() => ({
    close: vi.fn(),
    connect: vi.fn(),
  })),
}));

describe("nutrition MCP route", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.AGENT_NUTRITION_TOKEN = "test-token";
    process.env.AGENT_MEMBER_ID = "member-1";
  });

  it("accepts ChatGPT connector URL-token auth on MCP methods", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/mcp/nutrition?agentToken=test-token");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(payload.error.message).toBe("Method not allowed.");
  });

  it("returns CORS headers on unauthorized MCP requests", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/mcp/nutrition?agentToken=wrong-token");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("WWW-Authenticate")).toContain("resource_metadata=");
    expect(payload.error).toBe("Unauthorized.");
  });

  it("accepts OAuth bearer access tokens", async () => {
    const { createMcpAccessToken } = await import("../../../../lib/mcp-oauth");
    const token = createMcpAccessToken({
      clientId: "client-1",
      memberId: "oauth-member-1",
      scope: "nutrition:read nutrition:write",
    });
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/mcp/nutrition", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(payload.error.message).toBe("Method not allowed.");
  });
});
