import { NextResponse } from "next/server";

import { isOrgMember } from "../../../../lib/programming-access";
import { requireUserContext } from "../../../../lib/member";
import { isValidDate } from "../../../../lib/programming";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

function addDays(startDate: string, days: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";
  const trackId = url.searchParams.get("trackId") ?? "";
  const startDate = url.searchParams.get("startDate") ?? "";

  if (!organizationId || !trackId || !isValidDate(startDate)) {
    return NextResponse.json({ error: "organizationId, trackId and startDate are required." }, { status: 400 });
  }

  const member = await isOrgMember(userId, organizationId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const endDate = addDays(startDate, 6);

  const { data: days, error: daysError } = await supabaseAdmin
    .from("programming_days")
    .select("id, day_date, title, notes, is_published")
    .eq("organization_id", organizationId)
    .eq("track_id", trackId)
    .gte("day_date", startDate)
    .lte("day_date", endDate)
    .order("day_date", { ascending: true });

  if (daysError) {
    return NextResponse.json({ error: daysError.message }, { status: 500 });
  }

  const dayIds = (days ?? []).map((row) => row.id);

  const { data: blocks, error: blocksError } = dayIds.length
    ? await supabaseAdmin
        .from("workout_blocks")
        .select("id, programming_day_id, block_order, block_type, title, description, score_type, leaderboard_enabled, benchmark_enabled, benchmark_id, movement_id, percent_prescription, rounds, tags")
        .in("programming_day_id", dayIds)
        .order("block_order", { ascending: true })
    : { data: [], error: null };

  if (blocksError) {
    return NextResponse.json({ error: blocksError.message }, { status: 500 });
  }

  const blockIds = (blocks ?? []).map((row) => row.id);

  const { data: levels, error: levelsError } = blockIds.length
    ? await supabaseAdmin
        .from("workout_block_levels")
        .select("id, block_id, level, title, instructions")
        .in("block_id", blockIds)
        .order("level", { ascending: true })
    : { data: [], error: null };

  if (levelsError) {
    return NextResponse.json({ error: levelsError.message }, { status: 500 });
  }

  const levelsByBlock = (levels ?? []).reduce<Record<string, unknown[]>>((acc, levelRow) => {
    if (!acc[levelRow.block_id]) {
      acc[levelRow.block_id] = [];
    }
    acc[levelRow.block_id].push(levelRow);
    return acc;
  }, {});

  const blocksByDay = (blocks ?? []).reduce<Record<string, unknown[]>>((acc, blockRow) => {
    if (!acc[blockRow.programming_day_id]) {
      acc[blockRow.programming_day_id] = [];
    }
    acc[blockRow.programming_day_id].push({
      ...blockRow,
      levels: levelsByBlock[blockRow.id] ?? [],
    });
    return acc;
  }, {});

  return NextResponse.json({
    days: (days ?? []).map((dayRow) => ({
      ...dayRow,
      blocks: blocksByDay[dayRow.id] ?? [],
    })),
  });
}
