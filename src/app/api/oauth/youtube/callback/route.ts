import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { exchangeYoutubeCode, fetchYoutubeChannelId } from "../../../../../lib/youtube";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code." }, { status: 400 });
  }

  const { oauth2Client, tokens } = await exchangeYoutubeCode(code);
  const channelId = await fetchYoutubeChannelId(oauth2Client);

  const { data: existing } = await supabaseAdmin
    .from("youtube_oauth_tokens")
    .select("refresh_token")
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
      channel_id: channelId,
      refresh_token: refreshToken,
      access_token: tokens.access_token ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/content", request.url));
}
