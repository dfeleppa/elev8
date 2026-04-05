import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { buildSocialOverview } from "../../../../lib/social";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const overview = await buildSocialOverview(organizationId);
  const [postMetricsResult, accountMetricsResult] = await Promise.all([
    supabaseAdmin
      .from("social_post_metrics_daily")
      .select("social_post_id, platform, metric_date, impressions, reach, engagements, saves, shares, comments, likes, profile_actions")
      .eq("organization_id", organizationId)
      .order("metric_date", { ascending: false })
      .limit(120),
    supabaseAdmin
      .from("social_account_metrics_daily")
      .select("social_account_id, platform, metric_date, followers, reach, impressions, engagements, messages, comments")
      .eq("organization_id", organizationId)
      .order("metric_date", { ascending: false })
      .limit(120),
  ]);

  return NextResponse.json({
    overview,
    postMetrics: postMetricsResult.data ?? [],
    accountMetrics: accountMetricsResult.data ?? [],
  });
}
