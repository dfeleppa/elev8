import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import { createMcpAuthorizationCode, verifyRegisteredMcpClient } from "@/lib/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithError(redirectUri: string, error: string, state: string | null, description?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
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
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "";
  const scope = url.searchParams.get("scope") ?? "nutrition:read nutrition:write";
  const state = url.searchParams.get("state");

  const client = verifyRegisteredMcpClient(clientId);
  if (!client || !redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (responseType !== "code") {
    return redirectWithError(redirectUri, "unsupported_response_type", state);
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return redirectWithError(redirectUri, "invalid_request", state, "PKCE S256 is required.");
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
    memberId: context.userId,
    redirectUri,
    scope,
  });
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return NextResponse.redirect(redirectUrl);
}

