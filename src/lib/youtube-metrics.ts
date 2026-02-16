import "server-only";

import { supabaseAdmin } from "./supabase-admin";

type YoutubeMetrics = {
  views: number | null;
  watchMinutes: number | null;
  subscribersGained: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export async function getLatestYoutubeMetrics(): Promise<YoutubeMetrics> {
  const { data } = await supabaseAdmin
    .from("youtube_metrics")
    .select("views, watch_minutes, subscribers_gained, period_start, period_end")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    views: data?.views ?? null,
    watchMinutes: data?.watch_minutes ?? null,
    subscribersGained: data?.subscribers_gained ?? null,
    periodStart: data?.period_start ?? null,
    periodEnd: data?.period_end ?? null,
  };
}
