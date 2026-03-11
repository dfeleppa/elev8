import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  fetchYoutubeAnalytics,
  fetchYoutubeChannelStats,
  getYoutubeOAuthClient,
} from "../../../../lib/youtube";

export const runtime = "nodejs";

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!cronHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("youtube_oauth_tokens")
    .select("refresh_token, channel_id, member_id")
    .order("updated_at", { ascending: false })
    .limit(25);

  if (tokenError || !tokenRow || tokenRow.length === 0) {
    return NextResponse.json({ error: "Missing YouTube OAuth token." }, { status: 400 });
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);

  const results = [] as Array<{ memberId: string; channelId: string }>;

  for (const token of tokenRow) {
    if (!token.member_id) {
      continue;
    }

    const oauth2Client = getYoutubeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });

    const metrics = await fetchYoutubeAnalytics({
      oauth2Client,
      channelId: token.channel_id,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    });

    const channelStats = await fetchYoutubeChannelStats(oauth2Client);

    const { error } = await supabaseAdmin.from("youtube_metrics").upsert(
      {
        member_id: token.member_id,
        channel_id: token.channel_id,
        period_start: formatDate(startDate),
        period_end: formatDate(endDate),
        views: metrics.views,
        watch_minutes: metrics.watchMinutes,
        subscribers_gained: metrics.subscribersGained,
        subscribers_total: channelStats.subscriberCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,channel_id,period_start,period_end" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    results.push({ memberId: token.member_id, channelId: token.channel_id });
  }

  return NextResponse.json({
    ok: true,
    processed: results,
    period: {
      start: formatDate(startDate),
      end: formatDate(endDate),
    },
  });
}
