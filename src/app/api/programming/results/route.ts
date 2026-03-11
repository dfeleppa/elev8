import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../lib/programming-access";
import {
  getBestEstimatedOneRepMax,
  isValidDate,
  isWorkoutScoreType,
  type LiftSetInput,
} from "../../../../lib/programming";
import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

function parseLiftSets(value: unknown): LiftSetInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((set): set is LiftSetInput => {
      if (!set || typeof set !== "object") {
        return false;
      }
      const maybeSet = set as LiftSetInput;
      return Number.isFinite(maybeSet.reps) && Number.isFinite(maybeSet.weight);
    })
    .map((set) => ({ reps: Number(set.reps), weight: Number(set.weight) }))
    .filter((set) => set.reps > 0 && set.weight > 0);
}

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";
  const memberId = url.searchParams.get("memberId") ?? userId;

  if (!organizationId || !isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "organizationId, startDate and endDate are required." }, { status: 400 });
  }

  const member = await isOrgMember(userId, organizationId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (memberId !== userId) {
    const canViewOthers = await hasOrgRole(userId, organizationId, "coach");
    if (!canViewOthers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("workout_results")
    .select("id, block_id, day_date, member_id, level, score_type, score_text, score_value, total_reps, rounds, distance, calories, duration_seconds, is_rx, notes, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("member_id", memberId)
    .gte("day_date", startDate)
    .lte("day_date", endDate)
    .order("day_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const trackId = typeof body?.trackId === "string" ? body.trackId : "";
  const blockId = typeof body?.blockId === "string" ? body.blockId : "";
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";
  const memberId = typeof body?.memberId === "string" ? body.memberId : userId;
  const scoreType = body?.scoreType;
  const scoreText = typeof body?.scoreText === "string" ? body.scoreText.trim() : null;
  const scoreValue = typeof body?.scoreValue === "number" ? body.scoreValue : null;
  const totalReps = typeof body?.totalReps === "number" ? body.totalReps : null;
  const rounds = typeof body?.rounds === "number" ? body.rounds : null;
  const distance = typeof body?.distance === "number" ? body.distance : null;
  const calories = typeof body?.calories === "number" ? body.calories : null;
  const durationSeconds = typeof body?.durationSeconds === "number" ? body.durationSeconds : null;
  const level = typeof body?.level === "number" ? body.level : null;
  const isRx = Boolean(body?.isRx);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const liftSets = parseLiftSets(body?.liftSets);

  if (!organizationId || !trackId || !blockId || !isValidDate(dayDate) || !isWorkoutScoreType(scoreType)) {
    return NextResponse.json({ error: "Invalid workout result payload." }, { status: 400 });
  }

  const isMember = await isOrgMember(userId, organizationId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (memberId !== userId) {
    const canSubmitForOthers = await hasOrgRole(userId, organizationId, "coach");
    if (!canSubmitForOthers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: block, error: blockError } = await supabaseAdmin
    .from("workout_blocks")
    .select("id, movement_id, block_type")
    .eq("id", blockId)
    .eq("organization_id", organizationId)
    .single();

  if (blockError || !block?.id) {
    return NextResponse.json({ error: blockError?.message ?? "Workout block not found." }, { status: 404 });
  }

  const { data: result, error: resultError } = await supabaseAdmin
    .from("workout_results")
    .insert({
      organization_id: organizationId,
      track_id: trackId,
      block_id: blockId,
      day_date: dayDate,
      member_id: memberId,
      level,
      score_type: scoreType,
      score_text: scoreText,
      score_value: scoreValue,
      total_reps: totalReps,
      rounds,
      distance,
      calories,
      duration_seconds: durationSeconds,
      is_rx: isRx,
      notes,
      updated_at: new Date().toISOString(),
    })
    .select("id, block_id, day_date, member_id, level, score_type, score_text, score_value, total_reps, rounds, distance, calories, duration_seconds, is_rx, notes, created_at, updated_at")
    .single();

  if (resultError || !result?.id) {
    return NextResponse.json({ error: resultError?.message ?? "Failed to create result." }, { status: 500 });
  }

  if (liftSets.length > 0) {
    const setRows = liftSets.map((set, index) => ({
      result_id: result.id,
      set_order: index + 1,
      reps: set.reps,
      weight: set.weight,
      updated_at: new Date().toISOString(),
    }));

    const { error: setError } = await supabaseAdmin.from("workout_result_lift_sets").insert(setRows);
    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    if (block.movement_id) {
      const bestWeight = liftSets.reduce((max, set) => (set.weight > max ? set.weight : max), 0);
      const bestReps = liftSets.reduce((max, set) => (set.reps > max ? set.reps : max), 0);
      const estimatedOneRepMax = getBestEstimatedOneRepMax(liftSets);

      const { error: prError } = await supabaseAdmin
        .from("member_movement_prs")
        .upsert(
          {
            organization_id: organizationId,
            member_id: memberId,
            movement_id: block.movement_id,
            best_weight: bestWeight,
            best_reps: bestReps,
            estimated_one_rep_max: estimatedOneRepMax,
            source_result_id: result.id,
            recorded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,member_id,movement_id" }
        );

      if (prError) {
        return NextResponse.json({ error: prError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ result }, { status: 201 });
}
