import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "@/lib/programming-access";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type TransferMode = "copy" | "move";

type SourceBlock = {
  id: string;
  programming_day_id: string;
  block_order: number;
  block_type: string;
  title: string;
  description: string | null;
  score_type: string;
  leaderboard_enabled: boolean;
  benchmark_enabled: boolean;
  benchmark_id: string | null;
  movement_id: string | null;
  percent_prescription: number | null;
  rounds: number | null;
  tags: string[] | null;
};

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const blockIds: string[] = Array.isArray(body?.blockIds)
    ? body.blockIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  const targetTrackId = typeof body?.targetTrackId === "string" ? body.targetTrackId : "";
  const mode: TransferMode = body?.mode === "move" ? "move" : "copy";

  if (blockIds.length === 0 || !targetTrackId) {
    return NextResponse.json(
      { error: "blockIds and targetTrackId are required." },
      { status: 400 }
    );
  }

  const isMember = await isOrgMember(userId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, "", "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: trackRow, error: trackError } = await supabaseAdmin
    .from("programming_tracks")
    .select("id")
    .eq("id", targetTrackId)
    .maybeSingle();

  if (trackError || !trackRow?.id) {
    return NextResponse.json({ error: "Target track not found." }, { status: 404 });
  }

  const { data: sourceBlocks, error: sourceError } = await supabaseAdmin
    .from("workout_blocks")
    .select(
      "id, programming_day_id, block_order, block_type, title, description, score_type, leaderboard_enabled, benchmark_enabled, benchmark_id, movement_id, percent_prescription, rounds, tags"
    )
    .in("id", blockIds);

  if (sourceError) {
    return NextResponse.json({ error: "Failed to load source blocks." }, { status: 500 });
  }

  const blocks: SourceBlock[] = (sourceBlocks ?? []) as SourceBlock[];
  if (blocks.length === 0) {
    return NextResponse.json({ error: "No matching blocks found." }, { status: 404 });
  }

  const sourceDayIds = Array.from(new Set(blocks.map((b) => b.programming_day_id)));
  const { data: sourceDays, error: sourceDaysError } = await supabaseAdmin
    .from("programming_days")
    .select("id, day_date, track_id")
    .in("id", sourceDayIds);

  if (sourceDaysError || !sourceDays) {
    return NextResponse.json({ error: "Failed to load source days." }, { status: 500 });
  }

  const dateByDayId = new Map<string, string>();
  for (const day of sourceDays) {
    dateByDayId.set(day.id, day.day_date);
  }

  // Skip blocks already in the target track when copying — those would silently
  // duplicate themselves on the same day. Moving them is a no-op too, but harmless.
  const filteredBlocks = blocks.filter((block) => {
    const sourceDay = sourceDays.find((d) => d.id === block.programming_day_id);
    return sourceDay?.track_id !== targetTrackId;
  });

  if (filteredBlocks.length === 0) {
    return NextResponse.json(
      { error: "All selected blocks are already in the target track." },
      { status: 400 }
    );
  }

  // Group target dates so we upsert each (track, date) pair once.
  const targetDates = Array.from(
    new Set(
      filteredBlocks
        .map((b) => dateByDayId.get(b.programming_day_id))
        .filter((d): d is string => Boolean(d))
    )
  );

  const targetDayByDate = new Map<string, string>();
  for (const date of targetDates) {
    const { data: dayRow, error: dayError } = await supabaseAdmin
      .from("programming_days")
      .upsert(
        {
          track_id: targetTrackId,
          day_date: date,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "track_id,day_date" }
      )
      .select("id")
      .single();

    if (dayError || !dayRow?.id) {
      return NextResponse.json(
        { error: "Failed to prepare target day." },
        { status: 500 }
      );
    }
    targetDayByDate.set(date, dayRow.id);
  }

  // Compute next block_order per target day so copies append to the end.
  const targetDayIds = Array.from(targetDayByDate.values());
  const { data: existingBlocks, error: existingBlocksError } = await supabaseAdmin
    .from("workout_blocks")
    .select("programming_day_id, block_order")
    .in("programming_day_id", targetDayIds);

  if (existingBlocksError) {
    return NextResponse.json(
      { error: "Failed to read target day contents." },
      { status: 500 }
    );
  }

  const nextOrderByDay = new Map<string, number>();
  for (const dayId of targetDayIds) {
    nextOrderByDay.set(dayId, 0);
  }
  for (const row of existingBlocks ?? []) {
    const current = nextOrderByDay.get(row.programming_day_id) ?? 0;
    const candidate = (row.block_order ?? 0) + 1;
    if (candidate > current) {
      nextOrderByDay.set(row.programming_day_id, candidate);
    }
  }

  const resultIds: string[] = [];

  if (mode === "copy") {
    const insertRows = filteredBlocks.map((block) => {
      const date = dateByDayId.get(block.programming_day_id)!;
      const targetDayId = targetDayByDate.get(date)!;
      const nextOrder = nextOrderByDay.get(targetDayId) ?? 0;
      nextOrderByDay.set(targetDayId, nextOrder + 1);
      return {
        programming_day_id: targetDayId,
        track_id: targetTrackId,
        block_order: nextOrder,
        block_type: block.block_type,
        title: block.title,
        description: block.description,
        score_type: block.score_type,
        leaderboard_enabled: block.leaderboard_enabled,
        benchmark_enabled: block.benchmark_enabled,
        benchmark_id: block.benchmark_id,
        movement_id: block.movement_id,
        percent_prescription: block.percent_prescription,
        rounds: block.rounds,
        tags: block.tags ?? [],
        created_by: userId,
        updated_at: new Date().toISOString(),
      };
    });

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from("workout_blocks")
      .insert(insertRows)
      .select("id");

    if (insertError || !insertedRows) {
      return NextResponse.json({ error: "Failed to copy blocks." }, { status: 500 });
    }

    const newIds = insertedRows.map((row) => row.id);
    resultIds.push(...newIds);

    // Copy associated levels in one batch.
    const sourceIds = filteredBlocks.map((b) => b.id);
    const { data: sourceLevels, error: levelsError } = await supabaseAdmin
      .from("workout_block_levels")
      .select("block_id, level, title, instructions")
      .in("block_id", sourceIds);

    if (levelsError) {
      return NextResponse.json(
        { error: "Failed to load source levels." },
        { status: 500 }
      );
    }

    if ((sourceLevels ?? []).length > 0) {
      const newIdBySourceId = new Map<string, string>();
      filteredBlocks.forEach((block, index) => {
        newIdBySourceId.set(block.id, newIds[index]);
      });

      const levelInserts = (sourceLevels ?? [])
        .map((level) => {
          const newBlockId = newIdBySourceId.get(level.block_id);
          if (!newBlockId) return null;
          return {
            block_id: newBlockId,
            level: level.level,
            title: level.title,
            instructions: level.instructions,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (levelInserts.length > 0) {
        const { error: levelsInsertError } = await supabaseAdmin
          .from("workout_block_levels")
          .insert(levelInserts);
        if (levelsInsertError) {
          return NextResponse.json(
            { error: "Failed to copy block levels." },
            { status: 500 }
          );
        }
      }
    }
  } else {
    // Move: re-point each block to the matching target day on the new track.
    for (const block of filteredBlocks) {
      const date = dateByDayId.get(block.programming_day_id)!;
      const targetDayId = targetDayByDate.get(date)!;
      const nextOrder = nextOrderByDay.get(targetDayId) ?? 0;
      nextOrderByDay.set(targetDayId, nextOrder + 1);

      const { error: updateError } = await supabaseAdmin
        .from("workout_blocks")
        .update({
          programming_day_id: targetDayId,
          track_id: targetTrackId,
          block_order: nextOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", block.id);

      if (updateError) {
        return NextResponse.json({ error: "Failed to move block." }, { status: 500 });
      }
      resultIds.push(block.id);
    }
  }

  return NextResponse.json({ ok: true, mode, blockIds: resultIds });
}
