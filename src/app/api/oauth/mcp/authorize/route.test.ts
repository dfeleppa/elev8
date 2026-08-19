import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/member", () => ({
  requireUserContext: vi.fn(async () => ({ userId: "member-1" })),
}));

import {
  createRegisteredMcpClient,
  getMcpResource,
  verifyMcpAuthorizationCode,
} from "@/lib/mcp-oauth";

import { GET } from "./route";

const issuer = "https://app.daneff.com";
const resource = getMcpResource(issuer);
const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.MCP_OAUTH_ALLOWED_REDIRECT_URIS = redirectUri;
});

function createAuthorizeRequest(requestedResource = resource) {
  const client = createRegisteredMcpClient({
    client_name: "ChatGPT",
    redirect_uris: [redirectUri],
    scope: "nutrition:read nutrition:write offline_access",
    token_endpoint_auth_method: "none",
  });
  const url = new URL(`${issuer}/api/oauth/mcp/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", "challenge");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", requestedResource);
  url.searchParams.set("state", "state-1");
  return new Request(url);
}

describe("MCP OAuth authorization endpoint", () => {
  it("binds the authorization code to the issuer and MCP resource", async () => {
    const response = await GET(createAuthorizeRequest());
    const location = new URL(response.headers.get("location") ?? "");
    const authorization = verifyMcpAuthorizationCode(location.searchParams.get("code") ?? "");

    expect(response.status).toBe(307);
    expect(location.searchParams.get("iss")).toBe(issuer);
    expect(location.searchParams.get("state")).toBe("state-1");
    expect(authorization).toMatchObject({
      issuer,
      memberId: "member-1",
      resource,
    });
  });

  it("returns an issuer-identified error for a different resource", async () => {
    const response = await GET(createAuthorizeRequest("https://app.daneff.com/api/mcp/other"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.searchParams.get("error")).toBe("invalid_target");
    expect(location.searchParams.get("iss")).toBe(issuer);
    expect(location.searchParams.get("state")).toBe("state-1");
  });
});
