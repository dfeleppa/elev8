import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
const CLIENT_TTL_SECONDS = 365 * 24 * 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_SCOPES = ["nutrition:read", "nutrition:write"];

type SignedEnvelope<T extends Record<string, unknown>> = T & {
  exp: number;
  iat: number;
  typ: string;
};

export type RegisteredMcpClient = {
  client_id: string;
  client_secret?: string;
  client_id_issued_at: number;
  client_secret_expires_at?: number;
  client_name?: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
};

type ClientPayload = {
  clientName?: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
  scope?: string;
};

type AuthorizationCodePayload = {
  clientId: string;
  codeChallenge: string;
  memberId: string;
  redirectUri: string;
  scope?: string;
};

type AccessTokenPayload = {
  clientId: string;
  memberId: string;
  scope: string;
};

type RefreshTokenPayload = AccessTokenPayload;

function getSecret() {
  const secret = process.env.MCP_OAUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("MCP_OAUTH_SECRET or NEXTAUTH_SECRET is required for MCP OAuth.");
  }
  return secret;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function signValue(encodedPayload: string) {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signEnvelope<T extends Record<string, unknown>>(type: string, payload: T, ttlSeconds: number) {
  const issuedAt = nowSeconds();
  const envelope: SignedEnvelope<T> = {
    ...payload,
    exp: issuedAt + ttlSeconds,
    iat: issuedAt,
    typ: type,
  };
  const encodedPayload = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${type}_${encodedPayload}.${signValue(encodedPayload)}`;
}

function verifyEnvelope<T extends Record<string, unknown>>(value: string, type: string): SignedEnvelope<T> | null {
  const prefix = `${type}_`;
  if (!value.startsWith(prefix)) {
    return null;
  }

  const token = value.slice(prefix.length);
  const [encodedPayload, signature] = token.split(".", 2);
  if (!encodedPayload || !signature || !constantTimeEqual(signature, signValue(encodedPayload))) {
    return null;
  }

  const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SignedEnvelope<T>;
  if (parsed.typ !== type || typeof parsed.exp !== "number" || parsed.exp < nowSeconds()) {
    return null;
  }

  return parsed;
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getOriginFromRequest(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function getMcpOAuthMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/mcp/authorize`,
    token_endpoint: `${origin}/api/oauth/mcp/token`,
    registration_endpoint: `${origin}/api/oauth/mcp/register`,
    scopes_supported: OAUTH_SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
  };
}

export function getMcpProtectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp/nutrition`,
    authorization_servers: [origin],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Elev8 Nutrition MCP",
  };
}

export function createRegisteredMcpClient(metadata: {
  client_name?: string;
  redirect_uris?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
}) {
  const redirectUris = metadata.redirect_uris ?? [];
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.some((uri) => !isHttpsUrl(uri))) {
    throw new Error("redirect_uris must contain at least one HTTPS URL.");
  }

  const authMethod = metadata.token_endpoint_auth_method ?? "client_secret_post";
  if (!["none", "client_secret_basic", "client_secret_post"].includes(authMethod)) {
    throw new Error("Unsupported token_endpoint_auth_method.");
  }

  const clientId = signEnvelope<ClientPayload>(
    "mcp_client",
    {
      clientName: metadata.client_name,
      redirectUris,
      scope: metadata.scope,
      tokenEndpointAuthMethod: authMethod,
    },
    CLIENT_TTL_SECONDS
  );
  const clientIdIssuedAt = nowSeconds();
  const clientSecret =
    authMethod === "none"
      ? undefined
      : signEnvelope("mcp_client_secret", { clientId, nonce: randomBytes(16).toString("hex") }, CLIENT_TTL_SECONDS);

  return {
    client_id: clientId,
    client_secret: clientSecret,
    client_id_issued_at: clientIdIssuedAt,
    client_secret_expires_at: clientSecret ? clientIdIssuedAt + CLIENT_TTL_SECONDS : undefined,
    client_name: metadata.client_name,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: authMethod,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: metadata.scope,
  } satisfies RegisteredMcpClient;
}

export function verifyRegisteredMcpClient(clientId: string): RegisteredMcpClient | null {
  const payload = verifyEnvelope<ClientPayload>(clientId, "mcp_client");
  if (!payload) {
    return null;
  }

  return {
    client_id: clientId,
    client_id_issued_at: payload.iat,
    client_name: payload.clientName,
    redirect_uris: payload.redirectUris,
    token_endpoint_auth_method: payload.tokenEndpointAuthMethod,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: payload.scope,
  };
}

export function verifyMcpClientSecret(clientId: string, clientSecret: string) {
  const payload = verifyEnvelope<{ clientId: string }>(clientSecret, "mcp_client_secret");
  return payload?.clientId === clientId;
}

export function createMcpAuthorizationCode(payload: AuthorizationCodePayload) {
  return signEnvelope("mcp_code", payload, AUTHORIZATION_CODE_TTL_SECONDS);
}

export function verifyMcpAuthorizationCode(code: string) {
  return verifyEnvelope<AuthorizationCodePayload>(code, "mcp_code");
}

export function createMcpAccessToken(payload: AccessTokenPayload) {
  return signEnvelope("mcp_at", payload, ACCESS_TOKEN_TTL_SECONDS);
}

export function createMcpRefreshToken(payload: RefreshTokenPayload) {
  return signEnvelope("mcp_rt", payload, REFRESH_TOKEN_TTL_SECONDS);
}

export function verifyMcpRefreshToken(refreshToken: string) {
  return verifyEnvelope<RefreshTokenPayload>(refreshToken, "mcp_rt");
}

export function verifyMcpAccessToken(accessToken: string) {
  return verifyEnvelope<AccessTokenPayload>(accessToken, "mcp_at");
}

export function createS256CodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function parseBasicClientCredentials(authorization: string | null) {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  const splitIndex = decoded.indexOf(":");
  if (splitIndex < 0) {
    return null;
  }

  return {
    clientId: decodeURIComponent(decoded.slice(0, splitIndex)),
    clientSecret: decodeURIComponent(decoded.slice(splitIndex + 1)),
  };
}

