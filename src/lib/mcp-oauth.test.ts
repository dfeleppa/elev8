import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMcpAccessToken,
  createMcpAuthorizationCode,
  createRegisteredMcpClient,
  createS256CodeChallenge,
  getMcpOAuthMetadata,
  getMcpResource,
  getOriginFromRequest,
  normalizeMcpResource,
  verifyMcpAccessToken,
  verifyMcpAuthorizationCode,
  verifyRegisteredMcpClient,
} from "./mcp-oauth";

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS;
  delete process.env.MCP_OAUTH_ALLOWED_REDIRECT_URIS;
  delete process.env.MCP_PUBLIC_ORIGIN;
});

describe("MCP OAuth helpers", () => {
  it("registers a signed public client and verifies it statelessly", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS = "https://chatgpt.com";

    const client = createRegisteredMcpClient({
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/aip/test/oauth/callback"],
      token_endpoint_auth_method: "none",
    });

    const verified = verifyRegisteredMcpClient(client.client_id);

    expect(client.client_secret).toBeUndefined();
    expect(verified?.redirect_uris).toEqual(["https://chatgpt.com/aip/test/oauth/callback"]);
    expect(verified?.token_endpoint_auth_method).toBe("none");
  });

  it("signs authorization codes and access tokens with member context", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS = "https://chatgpt.com";
    const issuer = "https://app.daneff.com";
    const resource = getMcpResource(issuer);
    const challenge = createS256CodeChallenge("verifier");
    const code = createMcpAuthorizationCode({
      clientId: "client-1",
      codeChallenge: challenge,
      issuer,
      memberId: "member-1",
      redirectUri: "https://chatgpt.com/aip/test/oauth/callback",
      resource,
      scope: "nutrition:read nutrition:write offline_access",
    });

    const verifiedCode = verifyMcpAuthorizationCode(code);
    const accessToken = createMcpAccessToken({
      aud: resource,
      clientId: "client-1",
      iss: issuer,
      memberId: "member-1",
      scope: "nutrition:read nutrition:write offline_access",
    });
    const verifiedToken = verifyMcpAccessToken(accessToken, { issuer, resource });

    expect(verifiedCode?.codeChallenge).toBe(challenge);
    expect(verifiedCode?.resource).toBe(resource);
    expect(verifiedToken?.aud).toBe(resource);
    expect(verifiedToken?.iss).toBe(issuer);
    expect(verifiedToken?.memberId).toBe("member-1");
  });

  it("rejects an otherwise valid access token bound to another MCP resource", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    const issuer = "https://app.daneff.com";
    const token = createMcpAccessToken({
      aud: "https://app.daneff.com/api/mcp/other",
      clientId: "client-1",
      iss: issuer,
      memberId: "member-1",
      scope: "nutrition:read",
    });

    expect(
      verifyMcpAccessToken(token, {
        issuer,
        resource: getMcpResource(issuer),
      })
    ).toBeNull();
  });

  it("advertises issuer identification and enforces the canonical resource", () => {
    const issuer = "https://app.daneff.com";
    const resource = getMcpResource(issuer);
    const metadata = getMcpOAuthMetadata(issuer);

    expect(metadata.authorization_response_iss_parameter_supported).toBe(true);
    expect(metadata.scopes_supported).toContain("offline_access");
    expect(normalizeMcpResource(resource, resource)).toBe(resource);
    expect(() => normalizeMcpResource("https://example.com/api/mcp/nutrition", resource)).toThrow(
      /does not match/
    );
  });

  it("requires a canonical public origin and exact redirect allowlist in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS = "https://chatgpt.com";

    expect(() => getOriginFromRequest(new Request("https://preview.example.com/api/mcp/nutrition"))).toThrow(
      /MCP_PUBLIC_ORIGIN is required/
    );
    expect(() =>
      createRegisteredMcpClient({
        redirect_uris: ["https://chatgpt.com/connector/oauth/callback-id"],
        token_endpoint_auth_method: "none",
      })
    ).toThrow(/allowlist/);

    process.env.MCP_PUBLIC_ORIGIN = "https://app.daneff.com";
    process.env.MCP_OAUTH_ALLOWED_REDIRECT_URIS = "https://chatgpt.com/connector/oauth/callback-id";
    expect(getOriginFromRequest(new Request("https://preview.example.com/api/mcp/nutrition"))).toBe(
      "https://app.daneff.com"
    );
  });
});
