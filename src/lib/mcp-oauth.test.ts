import { describe, expect, it } from "vitest";

import {
  createMcpAccessToken,
  createMcpAuthorizationCode,
  createRegisteredMcpClient,
  createS256CodeChallenge,
  verifyMcpAccessToken,
  verifyMcpAuthorizationCode,
  verifyRegisteredMcpClient,
} from "./mcp-oauth";

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
    const challenge = createS256CodeChallenge("verifier");
    const code = createMcpAuthorizationCode({
      clientId: "client-1",
      codeChallenge: challenge,
      memberId: "member-1",
      redirectUri: "https://chatgpt.com/aip/test/oauth/callback",
      scope: "nutrition:read nutrition:write",
    });

    const verifiedCode = verifyMcpAuthorizationCode(code);
    const accessToken = createMcpAccessToken({
      clientId: "client-1",
      memberId: "member-1",
      scope: "nutrition:read nutrition:write",
    });
    const verifiedToken = verifyMcpAccessToken(accessToken);

    expect(verifiedCode?.codeChallenge).toBe(challenge);
    expect(verifiedToken?.memberId).toBe("member-1");
  });
});
