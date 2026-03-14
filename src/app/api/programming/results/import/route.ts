import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type ParsedCsvRow = {
  line: number;
  row: Record<string, string>;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(content: string): ParsedCsvRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = cols[j] ?? "";
    }
    rows.push({ line: i + 1, row });
  }

  return rows;
}

function parseDate(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toNumber(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDurationToSeconds(value: unknown) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":").map((x) => Number(x));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function normalizeStyle(style: unknown) {
  const normalized = String(style ?? "").trim().toLowerCase();
  if (normalized === "time") return { blockType: "workout", scoreType: "time" as const };
  if (normalized === "reps") return { blockType: "workout", scoreType: "reps" as const };
  if (normalized === "rounds") return { blockType: "workout", scoreType: "rounds_reps" as const };
  if (normalized === "distance") return { blockType: "workout", scoreType: "distance" as const };
  if (normalized === "load") return { blockType: "lift", scoreType: "none" as const };
  return { blockType: "workout", scoreType: "none" as const };
}

function parseRoundsReps(score: unknown) {
  const match = /^(\d+)\s*\+\s*(\d+)$/.exec(String(score ?? "").trim());
  if (!match) {
    return null;
  }
  return {
    rounds: Number(match[1]),
    reps: Number(match[2]),
    combined: Number(match[1]) * 1000 + Number(match[2]),
  };
}

async function ensureTrack(organizationId: string, userId: string, trackName: string) {
  const { data, error } = await supabaseAdmin
    .from("programming_tracks")
    .upsert(
      {
        organization_id: organizationId,
        name: trackName,
        code: "legacy-import",
        description: "Imported historical workout results",
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,name" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to upsert track '${trackName}': ${error?.message ?? "unknown error"}`);
  }

  return data.id as string;
}

async function ensureDay(organizationId: string, trackId: string, userId: string, dayDate: string) {
  const { data, error } = await supabaseAdmin
    .from("programming_days")
    .upsert(
      {
        organization_id: organizationId,
        track_id: trackId,
        day_date: dayDate,
        title: "Imported",
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "track_id,day_date" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to upsert programming day ${dayDate}: ${error?.message ?? "unknown error"}`);
  }

  return data.id as string;
}

async function ensureMovement(organizationId: string, movementName: string | null) {
  if (!movementName) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("movement_library")
    .upsert(
      {
        organization_id: organizationId,
        name: movementName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,name" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to upsert movement '${movementName}': ${error?.message ?? "unknown error"}`);
  }

  return data.id as string;
}

async function createBlockIfNeeded(params: {
  dayId: string;
  organizationId: string;
  trackId: string;
  userId: string;
  title: string;
  style: string;
  movementId: string | null;
  cache: Map<string, { id: string; movement_id: string | null }>;
}) {
  const styleInfo = normalizeStyle(params.style);
  const key = `${params.dayId}::${params.title}::${styleInfo.blockType}::${styleInfo.scoreType}::${params.movementId ?? "none"}`;
  if (params.cache.has(key)) {
    return params.cache.get(key)!;
  }

  const { data, error } = await supabaseAdmin
    .from("workout_blocks")
    .insert({
      programming_day_id: params.dayId,
      organization_id: params.organizationId,
      track_id: params.trackId,
      block_order: params.cache.size,
      block_type: styleInfo.blockType,
      title: params.title,
      score_type: styleInfo.scoreType,
      leaderboard_enabled: styleInfo.blockType !== "warmup" && styleInfo.blockType !== "cooldown",
      benchmark_enabled: false,
      movement_id: params.movementId,
      created_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, movement_id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create block '${params.title}': ${error?.message ?? "unknown error"}`);
  }

  const block = { id: data.id as string, movement_id: (data.movement_id as string | null) ?? null };
  params.cache.set(key, block);
  return block;
}

async function maybeUpsertPr(params: {
  organizationId: string;
  memberId: string;
  movementId: string | null;
  resultId: string;
  weight: number | null;
  reps: number | null;
}) {
  if (!params.movementId || !params.weight || !params.reps) {
    return;
  }

  const estimated = params.weight * (1 + params.reps / 30);

  const { data: existing } = await supabaseAdmin
    .from("member_movement_prs")
    .select("best_weight")
    .eq("organization_id", params.organizationId)
    .eq("member_id", params.memberId)
    .eq("movement_id", params.movementId)
    .maybeSingle();

  const currentBest = Number(existing?.best_weight ?? 0);
  if (params.weight < currentBest) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("member_movement_prs")
    .upsert(
      {
        organization_id: params.organizationId,
        member_id: params.memberId,
        movement_id: params.movementId,
        best_weight: params.weight,
        best_reps: params.reps,
        estimated_one_rep_max: estimated,
        source_result_id: params.resultId,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,member_id,movement_id" }
    );

  if (error) {
    throw new Error(`Failed to upsert PR: ${error.message}`);
  }
}

export async function POST(request: Request) {
  const { error, userId, organizationIds } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const csvText = typeof body?.csvText === "string" ? body.csvText : "";
  const trackName =
    typeof body?.trackName === "string" && body.trackName.trim()
      ? body.trackName.trim()
      : "Legacy Import";

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    return NextResponse.json({ error: "No organization found for user." }, { status: 400 });
  }

  const parsed = parseCsv(csvText);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "CSV is empty." }, { status: 400 });
  }

  const trackId = await ensureTrack(organizationId, userId, trackName);
  const blockCache = new Map<string, { id: string; movement_id: string | null }>();

  let insertedResults = 0;
  const failures: Array<{ line: number; title: string; error: string }> = [];

  for (const entry of parsed) {
    try {
      const title = String(entry.row.Title ?? "").trim() || "Imported Workout";
      const date = parseDate(String(entry.row.Date ?? ""));
      const styleRaw = String(entry.row.Style ?? "").trim();
      const repMax = toNumber(entry.row.RepMax);
      const primaryMovement = String(entry.row.PrimaryMovement ?? "").trim() || null;
      const bestScoreRaw = String(entry.row.BestScore ?? "").trim();
      const notes = String(entry.row.Notes ?? "").trim() || null;

      if (!date) {
        throw new Error(`Invalid date '${entry.row.Date ?? ""}'.`);
      }

      const dayId = await ensureDay(organizationId, trackId, userId, date);
      const movementId = await ensureMovement(organizationId, primaryMovement);
      const block = await createBlockIfNeeded({
        dayId,
        organizationId,
        trackId,
        userId,
        title,
        style: styleRaw,
        movementId,
        cache: blockCache,
      });

      const style = normalizeStyle(styleRaw);
      const resultPayload: Record<string, unknown> = {
        organization_id: organizationId,
        track_id: trackId,
        block_id: block.id,
        day_date: date,
        member_id: userId,
        score_type: style.scoreType,
        score_text: bestScoreRaw || null,
        score_value: null,
        total_reps: null,
        rounds: null,
        distance: null,
        calories: null,
        duration_seconds: null,
        is_rx: true,
        notes,
        updated_at: new Date().toISOString(),
      };

      if (style.scoreType === "time") {
        resultPayload.duration_seconds = parseDurationToSeconds(bestScoreRaw);
      }

      if (style.scoreType === "reps") {
        const reps = toNumber(bestScoreRaw);
        resultPayload.total_reps = reps;
        resultPayload.score_value = reps;
      }

      if (style.scoreType === "rounds_reps") {
        const rr = parseRoundsReps(bestScoreRaw);
        if (rr) {
          resultPayload.rounds = rr.rounds;
          resultPayload.total_reps = rr.reps;
          resultPayload.score_value = rr.combined;
        }
      }

      if (style.scoreType === "distance") {
        const distance = toNumber(bestScoreRaw);
        resultPayload.distance = distance;
        resultPayload.score_value = distance;
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("workout_results")
        .insert(resultPayload)
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        throw new Error(insertError?.message ?? "Failed to insert workout result.");
      }

      if (style.blockType === "lift") {
        const weight = toNumber(bestScoreRaw);
        const reps = repMax ?? 1;

        if (weight && reps) {
          const { error: liftSetError } = await supabaseAdmin.from("workout_result_lift_sets").insert({
            result_id: inserted.id,
            set_order: 1,
            reps,
            weight,
            updated_at: new Date().toISOString(),
          });

          if (liftSetError) {
            throw new Error(`Lift set insert failed: ${liftSetError.message}`);
          }

          await maybeUpsertPr({
            organizationId,
            memberId: userId,
            movementId: movementId ?? block.movement_id,
            resultId: inserted.id,
            weight,
            reps,
          });
        }
      }

      insertedResults += 1;
    } catch (importError) {
      failures.push({
        line: entry.line,
        title: entry.row.Title ?? "",
        error: importError instanceof Error ? importError.message : String(importError),
      });
    }
  }

  return NextResponse.json({
    trackName,
    inserted: insertedResults,
    totalRows: parsed.length,
    failures: failures.length,
    failureSamples: failures.slice(0, 20),
  });
}
