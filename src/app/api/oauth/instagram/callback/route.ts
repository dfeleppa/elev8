import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  exchangeInstagramCode,
  fetchInstagramAccount,
  INSTAGRAM_OAUTH_STATE_COOKIE,
} from "../../../../../lib/instagram";

export const runtime = "nodejs";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: NextRequest) {
  try {
    const { error: userError, role, userId } = await requireUserContext();
    if (userError || !userId || !hasRole("owner", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state")?.trim() ?? "";

    const storedRaw = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value?.trim() ?? "";
    const parsed = storedRaw ? JSON.parse(storedRaw) as { state?: string; organizationId?: string } : {};
    const storedState = parsed.state?.trim() ?? "";
    const organizationId = parsed.organizationId?.trim() ?? "";

    if (!code) {
      return NextResponse.json({ error: "Missing code." }, { status: 400 });
    }

    if (!state || !storedState || !constantTimeEqual(state, storedState)) {
      const response = NextResponse.json({ error: "Invalid OAuth state." }, { status: 400 });
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
    }

    if (!organizationId) {
      const response = NextResponse.json({ error: "Organization context missing." }, { status: 400 });
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
    }

    const token = await exchangeInstagramCode(code);
    const account = await fetchInstagramAccount(token.accessToken);

    const expiresAt =
      typeof token.expiresIn === "number"
        ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
        : null;

    const { error } = await supabaseAdmin.from("instagram_oauth_tokens").upsert(
      {
        organization_id: organizationId,
        member_id: userId,
        ig_user_id: account.igUserId,
        page_id: account.pageId,
        username: account.username,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,ig_user_id" }
    );

    if (error) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    const response = NextResponse.redirect(new URL("/content/meta", request.url));
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("Instagram OAuth callback failed:", message);
    const response = NextResponse.json({ error: "Internal server error." }, { status: 500 });
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  }
}
