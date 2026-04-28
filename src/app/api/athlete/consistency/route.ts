import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, role, userId } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 34);

  const startDateStr = startDate.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [{ data: results }, { data: prs }] = await Promise.all([
    supabaseAdmin
      .from("workout_results")
      .select("id, day_date")
      .eq("member_id", userId)
      .gte("day_date", startDateStr)
      .lte("day_date", todayStr),
    supabaseAdmin
      .from("member_movement_prs")
      .select("source_result_id")
      .eq("member_id", userId)
      .not("source_result_id", "is", null),
  ]);

  const prResultIds = new Set(
    (prs ?? []).map((pr: { source_result_id: string }) => pr.source_result_id),
  );

  // Build per-date status: PR beats logged
  const dateStatus = new Map<string, "logged" | "pr">();
  for (const result of results ?? []) {
    if (!result.day_date) continue;
    const isPR = prResultIds.has(result.id);
    const current = dateStatus.get(result.day_date);
    if (isPR || current === undefined) {
      dateStatus.set(result.day_date, isPR ? "pr" : "logged");
    }
  }

  // Build 35-day grid oldest → newest
  const days: { date: string; status: "empty" | "logged" | "pr" }[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, status: dateStatus.get(dateStr) ?? "empty" });
  }

  // Streak: consecutive days back from today (skip today if empty, check yesterday)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].status !== "empty") {
      streak++;
    } else if (streak === 0 && i === days.length - 1) {
      // Today is empty — allow streak to still count from yesterday
      continue;
    } else {
      break;
    }
  }

  return NextResponse.json({ streak, days });
}
