import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { isValidDate } from "@/lib/programming";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function addDays(startDate: string, days: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const trackId = url.searchParams.get("trackId") ?? "";
  const startDate = url.searchParams.get("startDate") ?? "";

  if ( !trackId || !isValidDate(startDate)) {
    return NextResponse.json({ error: "trackId and startDate are required." }, { status: 400 });
  }

  const { data: track, error: trackError } = await supabaseAdmin
    .from("programming_tracks")
    .select("id, is_active, is_private")
    .eq("id", trackId)
    .maybeSingle();

  if (trackError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
  if (!track) {
    return NextResponse.json({ error: "Track not found." }, { status: 404 });
  }
  if (!hasRole("coach", role) && (!track.is_active || track.is_private)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const endDate = addDays(startDate, 6);

  let daysQuery = supabaseAdmin
    .from("programming_days")
    .select("id, day_date, title, notes, is_published")
    .eq("track_id", trackId)
    .gte("day_date", startDate)
    .lte("day_date", endDate)
    .order("day_date", { ascending: true });
  if (!hasRole("coach", role)) {
    daysQuery = daysQuery.eq("is_published", true);
  }
  const { data: days, error: daysError } = await daysQuery;

  if (daysError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
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
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
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
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
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
