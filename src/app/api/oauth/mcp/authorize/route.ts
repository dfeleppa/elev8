import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import {
  createMcpAuthorizationCode,
  getMcpResource,
  getOriginFromRequest,
  normalizeMcpResource,
  normalizeMcpScope,
  verifyRegisteredMcpClient,
} from "@/lib/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithError(
  redirectUri: string,
  issuer: string,
  error: string,
  state: string | null,
  description?: string
) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("iss", issuer);
  if (description) {
    url.searchParams.set("error_description", description);
  }
  if (state) {
    url.searchParams.set("state", state);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const issuer = getOriginFromRequest(request);
  const expectedResource = getMcpResource(issuer);
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "";
  let resource = expectedResource;
  let scope = "nutrition:read offline_access";
  const state = url.searchParams.get("state");

  const client = verifyRegisteredMcpClient(clientId);
  if (!client || !redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    scope = normalizeMcpScope(url.searchParams.get("scope") ?? client.scope);
  } catch {
    return redirectWithError(redirectUri, issuer, "invalid_scope", state);
  }

  try {
    resource = normalizeMcpResource(url.searchParams.get("resource"), expectedResource);
  } catch (error) {
    return redirectWithError(
      redirectUri,
      issuer,
      "invalid_target",
      state,
      error instanceof Error ? error.message : "Invalid OAuth resource."
    );
  }

  if (responseType !== "code") {
    return redirectWithError(redirectUri, issuer, "unsupported_response_type", state);
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return redirectWithError(redirectUri, issuer, "invalid_request", state, "PKCE S256 is required.");
  }

  const context = await requireUserContext();
  if (context.error || !context.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const code = createMcpAuthorizationCode({
    clientId,
    codeChallenge,
    issuer,
    memberId: context.userId,
    redirectUri,
    resource,
    scope,
  });
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("iss", issuer);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return NextResponse.redirect(redirectUrl);
}

