import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock } = vi.hoisted(() => ({ insertMock: vi.fn() }));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

import {
  createMcpAuthorizationCode,
  createRegisteredMcpClient,
  createS256CodeChallenge,
  getMcpResource,
  verifyMcpAccessToken,
} from "@/lib/mcp-oauth";

import { POST } from "./route";

const issuer = "https://app.daneff.com";
const resource = getMcpResource(issuer);
const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.MCP_OAUTH_ALLOWED_REDIRECT_URIS = redirectUri;
  insertMock.mockResolvedValue({ error: null });
});

function createExchangeRequest(requestedResource = resource) {
  const verifier = "a-long-enough-pkce-verifier-for-testing";
  const client = createRegisteredMcpClient({
    client_name: "ChatGPT",
    redirect_uris: [redirectUri],
    scope: "nutrition:read nutrition:write offline_access",
    token_endpoint_auth_method: "none",
  });
  const code = createMcpAuthorizationCode({
    clientId: client.client_id,
    codeChallenge: createS256CodeChallenge(verifier),
    issuer,
    memberId: "member-1",
    redirectUri,
    resource,
    scope: "nutrition:read nutrition:write offline_access",
  });
  const body = new URLSearchParams({
    client_id: client.client_id,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    resource: requestedResource,
  });

  return new Request(`${issuer}/api/oauth/mcp/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("MCP OAuth token endpoint", () => {
  it("issues resource-bound access and refresh tokens", async () => {
    const response = await POST(createExchangeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.refresh_token).toEqual(expect.any(String));
    expect(payload.scope).toContain("offline_access");
    expect(
      verifyMcpAccessToken(payload.access_token, {
        issuer,
        resource,
      })
    ).toMatchObject({
      aud: resource,
      iss: issuer,
      memberId: "member-1",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a token exchange for a different resource before consuming the code", async () => {
    const response = await POST(createExchangeRequest("https://app.daneff.com/api/mcp/other"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_target");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
