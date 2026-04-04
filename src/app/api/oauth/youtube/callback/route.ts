import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  exchangeYoutubeCode,
  fetchYoutubeChannelId,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "../../../../../lib/youtube";

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
    const storedState = request.cookies.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value?.trim() ?? "";

    if (!code) {
      return NextResponse.json({ error: "Missing code." }, { status: 400 });
    }

    if (!state || !storedState || !constantTimeEqual(state, storedState)) {
      const response = NextResponse.json({ error: "Invalid OAuth state." }, { status: 400 });
      response.cookies.delete(YOUTUBE_OAUTH_STATE_COOKIE);
      return response;
    }

    const { oauth2Client, tokens } = await exchangeYoutubeCode(code);
    const channelId = await fetchYoutubeChannelId(oauth2Client);

    const { data: existing } = await supabaseAdmin
      .from("youtube_oauth_tokens")
      .select("refresh_token")
      .eq("member_id", userId)
      .eq("channel_id", channelId)
      .maybeSingle();

    const refreshToken = tokens.refresh_token ?? existing?.refresh_token;
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Missing refresh token. Revoke access and re-authenticate." },
        { status: 400 }
      );
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    const { error } = await supabaseAdmin.from("youtube_oauth_tokens").upsert(
      {
        member_id: userId,
        channel_id: channelId,
        refresh_token: refreshToken,
        access_token: tokens.access_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,channel_id" }
    );

    if (error) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    const response = NextResponse.redirect(new URL("/content", request.url));
    response.cookies.delete(YOUTUBE_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("YouTube OAuth callback failed:", message);
    const response = NextResponse.json({ error: "Internal server error." }, { status: 500 });
    response.cookies.delete(YOUTUBE_OAUTH_STATE_COOKIE);
    return response;
  }
}
