import { NextResponse } from "next/server";

import { hasOrgRole } from "../../../../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../../../../lib/member";
import { isLiftProgressionType, LIFT_PROGRESSION_TYPES } from "../../../../../../../../lib/programs";
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
    .from("program_lift_progressions")
    .select("id, block_id, week_number, progression_type, sets, reps, percent_of_max, rpe_target, weight_increment, starting_weight, notes, created_at, updated_at")
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
    progressionType: unknown;
    sets: unknown;
    reps: unknown;
    percentOfMax?: unknown;
    rpeTarget?: unknown;
    weightIncrement?: unknown;
    startingWeight?: unknown;
    notes?: unknown;
  };

  const upsertRows = rows
    .filter((row: RowInput) =>
      Number.isInteger(row.weekNumber) &&
      (row.weekNumber as number) >= 1 &&
      (row.weekNumber as number) <= program.duration_weeks &&
      isLiftProgressionType(row.progressionType) &&
      typeof row.reps === "string" &&
      row.reps.trim()
    )
    .map((row: RowInput) => ({
      block_id: blockId,
      program_id: programId,
      week_number: row.weekNumber as number,
      progression_type: row.progressionType as string,
      sets: Number.isInteger(row.sets) && (row.sets as number) >= 1 ? row.sets as number : 3,
      reps: (row.reps as string).trim(),
      percent_of_max:
        typeof row.percentOfMax === "number" && row.percentOfMax > 0 ? row.percentOfMax : null,
      rpe_target:
        typeof row.rpeTarget === "number" && row.rpeTarget >= 1 && row.rpeTarget <= 10
          ? row.rpeTarget
          : null,
      weight_increment:
        typeof row.weightIncrement === "number" ? row.weightIncrement : null,
      starting_weight:
        typeof row.startingWeight === "number" && row.startingWeight > 0 ? row.startingWeight : null,
      notes:
        typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : null,
      updated_at: new Date().toISOString(),
    }));

  if (upsertRows.length === 0) {
    return NextResponse.json(
      { error: `Each row requires weekNumber, progressionType (${LIFT_PROGRESSION_TYPES.join("|")}), and reps.` },
      { status: 400 }
    );
  }

  const { data, error: upsertError } = await supabaseAdmin
    .from("program_lift_progressions")
    .upsert(upsertRows, { onConflict: "block_id,week_number" })
    .select("id, block_id, week_number, progression_type, sets, reps, percent_of_max, rpe_target, weight_increment, starting_weight, notes, updated_at");

  if (upsertError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ progressions: data ?? [] });
}
