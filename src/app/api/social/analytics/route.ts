import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { buildSocialOverview } from "../../../../lib/social";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const overview = await buildSocialOverview();
  const [postMetricsResult, accountMetricsResult] = await Promise.all([
    supabaseAdmin
      .from("social_post_metrics_daily")
      .select("social_post_id, platform, metric_date, impressions, reach, engagements, saves, shares, comments, likes, profile_actions")
      .order("metric_date", { ascending: false })
      .limit(120),
    supabaseAdmin
      .from("social_account_metrics_daily")
      .select("social_account_id, platform, metric_date, followers, reach, impressions, engagements, messages, comments")
      .order("metric_date", { ascending: false })
      .limit(120),
  ]);

  return NextResponse.json({
    overview,
    postMetrics: postMetricsResult.data ?? [],
    accountMetrics: accountMetricsResult.data ?? [],
  });
}
