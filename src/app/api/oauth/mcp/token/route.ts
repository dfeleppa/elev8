import { NextResponse } from "next/server";

import {
  createMcpAccessToken,
  createMcpRefreshToken,
  createS256CodeChallenge,
  getMcpResource,
  getOriginFromRequest,
  hasMcpScope,
  hashMcpToken,
  normalizeMcpResource,
  parseBasicClientCredentials,
  verifyMcpAuthorizationCode,
  verifyMcpClientSecret,
  verifyMcpRefreshToken,
  verifyRegisteredMcpClient,
} from "@/lib/mcp-oauth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withCors(response: Response) {
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", "*");
  next.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  next.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return next;
}

function oauthError(error: string, description: string, status = 400) {
  return withCors(NextResponse.json({ error, error_description: description }, { status }));
}

async function markTokenUsed(token: string, tokenType: "authorization_code" | "refresh_token", expiresAt: number) {
  const { error } = await supabaseAdmin.from("mcp_oauth_used_tokens").insert({
    token_hash: hashMcpToken(token),
    token_type: tokenType,
    expires_at: new Date(expiresAt * 1000).toISOString(),
  });

  return !error;
}

async function readTokenParams(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, string> | null;
    return new URLSearchParams(body ?? {});
  }
  return new URLSearchParams(await request.text());
}

function authenticateClient(request: Request, params: URLSearchParams) {
  const basic = parseBasicClientCredentials(request.headers.get("authorization"));
  const clientId = basic?.clientId ?? params.get("client_id") ?? "";
  const clientSecret = basic?.clientSecret ?? params.get("client_secret") ?? "";
  const client = verifyRegisteredMcpClient(clientId);

  if (!client) {
    return null;
  }

  const authMethod = client.token_endpoint_auth_method ?? "client_secret_post";
  if (authMethod !== "none" && !verifyMcpClientSecret(clientId, clientSecret)) {
    return null;
  }

  return client;
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request) {
  const params = await readTokenParams(request);
  const grantType = params.get("grant_type");
  const client = authenticateClient(request, params);
  const issuer = getOriginFromRequest(request);
  const expectedResource = getMcpResource(issuer);

  if (!client) {
    return oauthError("invalid_client", "Client authentication failed.", 401);
  }

  if (grantType === "authorization_code") {
    const code = params.get("code") ?? "";
    const redirectUri = params.get("redirect_uri") ?? "";
    const codeVerifier = params.get("code_verifier") ?? "";
    const authorization = verifyMcpAuthorizationCode(code);

    if (!authorization || authorization.clientId !== client.client_id || authorization.redirectUri !== redirectUri) {
      return oauthError("invalid_grant", "Invalid authorization code.");
    }
    if (authorization.issuer !== issuer || authorization.resource !== expectedResource) {
      return oauthError("invalid_grant", "Authorization code was issued for a different resource.");
    }

    if (createS256CodeChallenge(codeVerifier) !== authorization.codeChallenge) {
      return oauthError("invalid_grant", "Invalid PKCE code verifier.");
    }
    try {
      normalizeMcpResource(params.get("resource"), authorization.resource);
    } catch {
      return oauthError("invalid_target", "OAuth resource does not match the authorization code.");
    }
    if (!(await markTokenUsed(code, "authorization_code", authorization.exp))) {
      return oauthError("invalid_grant", "Invalid authorization code.");
    }

    const scope = authorization.scope || "nutrition:read offline_access";
    const accessToken = createMcpAccessToken({
      aud: authorization.resource,
      clientId: client.client_id,
      iss: issuer,
      memberId: authorization.memberId,
      scope,
    });
    const refreshToken = hasMcpScope(scope, "offline_access")
      ? createMcpRefreshToken({
          aud: authorization.resource,
          clientId: client.client_id,
          iss: issuer,
          memberId: authorization.memberId,
          scope,
        })
      : undefined;

    return withCors(
      NextResponse.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        scope,
      })
    );
  }

  if (grantType === "refresh_token") {
    const refresh = verifyMcpRefreshToken(params.get("refresh_token") ?? "");
    if (!refresh || refresh.clientId !== client.client_id) {
      return oauthError("invalid_grant", "Invalid refresh token.");
    }
    if (refresh.iss !== issuer || refresh.aud !== expectedResource) {
      return oauthError("invalid_grant", "Refresh token was issued for a different resource.");
    }
    try {
      normalizeMcpResource(params.get("resource"), refresh.aud);
    } catch {
      return oauthError("invalid_target", "OAuth resource does not match the refresh token.");
    }
    const refreshTokenParam = params.get("refresh_token") ?? "";
    if (!(await markTokenUsed(refreshTokenParam, "refresh_token", refresh.exp))) {
      return oauthError("invalid_grant", "Invalid refresh token.");
    }

    const accessToken = createMcpAccessToken({
      aud: refresh.aud,
      clientId: client.client_id,
      iss: refresh.iss,
      memberId: refresh.memberId,
      scope: refresh.scope,
    });
    const refreshToken = createMcpRefreshToken({
      aud: refresh.aud,
      clientId: client.client_id,
      iss: refresh.iss,
      memberId: refresh.memberId,
      scope: refresh.scope,
    });

    return withCors(
      NextResponse.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: refresh.scope,
      })
    );
  }

  return oauthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported.");
}

