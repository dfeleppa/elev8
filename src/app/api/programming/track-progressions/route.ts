import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import { hasOrgRole } from "@/lib/programming-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/programming/track-progressions?blockId=X
// Returns the progression (with weeks) for a given workout_block id,
// or { progression: null } if none exists.
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId") ?? "";

  if (!blockId) {
    return NextResponse.json({ error: "blockId is required." }, { status: 400 });
  }

  const canRead = await hasOrgRole(userId, "", "coach");
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch the progression (UNIQUE on source_block_id so at most one row).
  const { data: progression, error: progError } = await supabaseAdmin
    .from("track_progressions")
    .select("*")
    .eq("source_block_id", blockId)
    .maybeSingle();

  if (progError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  if (!progression) {
    return NextResponse.json({ progression: null });
  }

  // Fetch weeks ordered by week_number.
  const { data: weeks, error: weeksError } = await supabaseAdmin
    .from("track_progression_weeks")
    .select("*")
    .eq("progression_id", progression.id)
    .order("week_number", { ascending: true });

  if (weeksError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ progression: { ...progression, weeks: weeks ?? [] } });
}

// ---------------------------------------------------------------------------
// PUT /api/programming/track-progressions
// Upserts the progression header and replaces all weeks.
// Body: { blockId, organizationId, trackId, category, startDate, durationWeeks, weeks[] }
// ---------------------------------------------------------------------------
export async function PUT(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    blockId,
    trackId,
    category,
    startDate,
    durationWeeks,
    weeks,
  } = body as {
    blockId: string;
    trackId: string;
    category: "lift" | "conditioning";
    startDate: string;
    durationWeeks: number;
    weeks: Array<Record<string, unknown>>;
  };

  if (!blockId || !trackId || !category || !startDate || !durationWeeks) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!["lift", "conditioning"].includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const admin = await hasOrgRole(userId, "", "admin");
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upsert progression header.
  const { data: progression, error: upsertError } = await supabaseAdmin
    .from("track_progressions")
    .upsert(
      {
        track_id: trackId,
        source_block_id: blockId,
        start_date: startDate,
        duration_weeks: durationWeeks,
        category,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_block_id" }
    )
    .select("id")
    .single();

  if (upsertError || !progression) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const progressionId = progression.id;

  // Replace all weeks: delete existing then insert new.
  const { error: deleteError } = await supabaseAdmin
    .from("track_progression_weeks")
    .delete()
    .eq("progression_id", progressionId);

  if (deleteError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  if (Array.isArray(weeks) && weeks.length > 0) {
    const rows = weeks.map((w) => ({
      progression_id: progressionId,
      week_number: w.weekNumber,
      week_type: w.weekType ?? "normal",
      // lift
      sets: toIntOrNull(w.sets),
      reps: toTextOrNull(w.reps),
      progression_type: toTextOrNull(w.progressionType),
      percent_of_max: toNumOrNull(w.percentOfMax),
      rpe_target: toNumOrNull(w.rpeTarget),
      weight_increment: toNumOrNull(w.weightIncrement),
      starting_weight: toNumOrNull(w.startingWeight),
      // conditioning
      modality: toTextOrNull(w.modality),
      conditioning_type: toTextOrNull(w.conditioningType),
      distance_meters: toIntOrNull(w.distanceMeters),
      duration_seconds: toIntOrNull(w.durationSeconds),
      interval_count: toIntOrNull(w.intervalCount),
      interval_distance_meters: toIntOrNull(w.intervalDistanceMeters),
      interval_rest_seconds: toIntOrNull(w.intervalRestSeconds),
      target_pace_per_500m: toIntOrNull(w.targetPacePer500m),
      notes: toTextOrNull(w.notes),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("track_progression_weeks")
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  }

  return NextResponse.json({ progressionId });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

function toTextOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}
