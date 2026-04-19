import { NextResponse } from "next/server";

import { hasOrgRole } from "../../../../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../../../../lib/member";
import {
  isConditioningModality,
  isConditioningProgressionType,
  CONDITIONING_MODALITIES,
  CONDITIONING_PROGRESSION_TYPES,
} from "../../../../../../../../lib/programs";
import { supabaseAdmin } from "../../../../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ programId: string; blockId: string }> };

async function resolveProgram(programId: string) {
  const { data, error } = await supabaseAdmin
    .from("programs")
    .select("duration_weeks")
    .eq("id", programId)
    .single();
  if (error || !data) return null;
  return data as { duration_weeks: number };
}

export async function GET(_request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId, blockId } = await context.params;

  const program = await resolveProgram(programId);
  if (!program) return NextResponse.json({ error: "Program not found." }, { status: 404 });


  const { data, error: fetchError } = await supabaseAdmin
    .from("program_conditioning_progressions")
    .select("id, block_id, week_number, modality, progression_type, distance_meters, duration_seconds, interval_count, interval_distance_meters, interval_rest_seconds, target_pace_per_500m, notes, created_at, updated_at")
    .eq("block_id", blockId)
    .eq("program_id", programId)
    .order("week_number", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ progressions: data ?? [] });
}

export async function PUT(request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId, blockId } = await context.params;

  const program = await resolveProgram(programId);
  if (!program) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  const canWrite = await hasOrgRole(userId, "", "admin");
  if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.progressions) ? body.progressions : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "progressions array is required." }, { status: 400 });
  }

  type RowInput = {
    weekNumber: unknown;
    modality: unknown;
    progressionType: unknown;
    distanceMeters?: unknown;
    durationSeconds?: unknown;
    intervalCount?: unknown;
    intervalDistanceMeters?: unknown;
    intervalRestSeconds?: unknown;
    targetPacePer500m?: unknown;
    notes?: unknown;
  };

  const upsertRows = rows
    .filter((row: RowInput) =>
      Number.isInteger(row.weekNumber) &&
      (row.weekNumber as number) >= 1 &&
      (row.weekNumber as number) <= program.duration_weeks &&
      isConditioningModality(row.modality) &&
      isConditioningProgressionType(row.progressionType)
    )
    .map((row: RowInput) => ({
      block_id: blockId,
      program_id: programId,
      week_number: row.weekNumber as number,
      modality: row.modality as string,
      progression_type: row.progressionType as string,
      distance_meters:
        typeof row.distanceMeters === "number" && row.distanceMeters > 0 ? row.distanceMeters : null,
      duration_seconds:
        Number.isInteger(row.durationSeconds) && (row.durationSeconds as number) > 0
          ? row.durationSeconds as number
          : null,
      interval_count:
        Number.isInteger(row.intervalCount) && (row.intervalCount as number) > 0
          ? row.intervalCount as number
          : null,
      interval_distance_meters:
        typeof row.intervalDistanceMeters === "number" && row.intervalDistanceMeters > 0
          ? row.intervalDistanceMeters
          : null,
      interval_rest_seconds:
        Number.isInteger(row.intervalRestSeconds) && (row.intervalRestSeconds as number) >= 0
          ? row.intervalRestSeconds as number
          : null,
      target_pace_per_500m:
        Number.isInteger(row.targetPacePer500m) && (row.targetPacePer500m as number) > 0
          ? row.targetPacePer500m as number
          : null,
      notes:
        typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : null,
      updated_at: new Date().toISOString(),
    }));

  if (upsertRows.length === 0) {
    return NextResponse.json(
      {
        error: `Each row requires weekNumber, modality (${CONDITIONING_MODALITIES.join("|")}), and progressionType (${CONDITIONING_PROGRESSION_TYPES.join("|")}).`,
      },
      { status: 400 }
    );
  }

  const { data, error: upsertError } = await supabaseAdmin
    .from("program_conditioning_progressions")
    .upsert(upsertRows, { onConflict: "block_id,week_number" })
    .select("id, block_id, week_number, modality, progression_type, distance_meters, duration_seconds, interval_count, interval_distance_meters, interval_rest_seconds, target_pace_per_500m, notes, updated_at");

  if (upsertError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ progressions: data ?? [] });
}
