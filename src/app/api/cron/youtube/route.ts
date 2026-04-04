import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  fetchYoutubeAnalytics,
  fetchYoutubeChannelStats,
  getYoutubeOAuthClient,
} from "../../../../lib/youtube";

export const runtime = "nodejs";
const CRON_BATCH_CONCURRENCY = 4;

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expected)) {
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

  const results: Array<{ memberId: string; channelId: string }> = [];
  const tokens = tokenRow.filter((token) => Boolean(token.member_id));

  for (let i = 0; i < tokens.length; i += CRON_BATCH_CONCURRENCY) {
    const batch = tokens.slice(i, i + CRON_BATCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (token) => {
        const oauth2Client = getYoutubeOAuthClient();
        oauth2Client.setCredentials({ refresh_token: token.refresh_token });

        const [metrics, channelStats] = await Promise.all([
          fetchYoutubeAnalytics({
            oauth2Client,
            channelId: token.channel_id,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          }),
          fetchYoutubeChannelStats(oauth2Client),
        ]);

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

        if (error || !token.member_id) {
          throw new Error("youtube_metrics_upsert_failed");
        }

        return { memberId: token.member_id, channelId: token.channel_id };
      })
    ).catch(() => null);

    if (!batchResults) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    results.push(...batchResults);
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
