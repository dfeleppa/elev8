import { NextResponse } from "next/server";

import { isOrgMember } from "@/lib/programming-access";
import { requireUserContext } from "@/lib/member";
import { isValidDate } from "@/lib/programming";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId") ?? "";
  const dayDate = url.searchParams.get("dayDate") ?? "";

  if (!blockId || !isValidDate(dayDate)) {
    return NextResponse.json({ error: "blockId and dayDate are required." }, { status: 400 });
  }

  const member = await isOrgMember(userId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: block, error: blockError } = await supabaseAdmin
    .from("workout_blocks")
    .select("id, score_type, leaderboard_enabled")
    .eq("id", blockId)
    .single();

  if (blockError || !block?.id) {
    return NextResponse.json({ error: blockError?.message ?? "Block not found." }, { status: 404 });
  }

  if (!block.leaderboard_enabled) {
    return NextResponse.json({ leaderboard: [] });
  }

  const sortAscending = block.score_type === "time";

  const { data, error: resultError } = await supabaseAdmin
    .from("workout_results")
    .select("id, member_id, score_type, score_text, score_value, total_reps, rounds, distance, calories, duration_seconds, is_rx, created_at")
    .eq("block_id", blockId)
    .eq("day_date", dayDate)
    .order(sortAscending ? "duration_seconds" : "score_value", { ascending: sortAscending, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (resultError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  // Batch-fetch member names.
  const memberIds = [...new Set((data ?? []).map((r) => r.member_id).filter(Boolean))];
  const { data: users } = memberIds.length
    ? await supabaseAdmin.from("app_users").select("id, full_name, email").in("id", memberIds)
    : { data: [] };

  const nameMap = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u.full_name ?? u.email ?? "Athlete"])
  );

  const leaderboard = (data ?? []).map((entry, index) => ({
    rank: index + 1,
    ...entry,
    memberName: nameMap[entry.member_id] ?? "Athlete",
  }));

  return NextResponse.json({ leaderboard });
}
