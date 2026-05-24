import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "@/lib/programming-access";
import {
  isValidDate,
  isWorkoutBlockType,
  isWorkoutScoreType,
  WORKOUT_BLOCK_TYPES,
  WORKOUT_SCORE_TYPES,
  type WorkoutBlockType,
  type WorkoutScoreType,
} from "@/lib/programming";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type IncomingBlock = {
  blockType: WorkoutBlockType;
  title: string;
  description?: string | null;
  scoreType?: WorkoutScoreType;
  blockOrder?: number;
  rounds?: number | null;
  rep_scheme?: string | null;
  time_domain_seconds?: number | null;
  stimulus?: string[];
  modality?: string[];
  equipment?: string[];
  tags?: string[];
};

type ImportedBlockResult = {
  date: string;
  blockType: WorkoutBlockType;
  title: string;
  blockId: string;
};

type SkippedBlockResult = {
  date: string;
  blockType?: string;
  title?: string;
  reason: string;
};

function parseBlock(raw: unknown): IncomingBlock | string {
  if (!raw || typeof raw !== "object") return "block is not an object";
  const b = raw as Record<string, unknown>;

  const blockType = b.blockType;
  if (!isWorkoutBlockType(blockType)) {
    return `blockType must be one of: ${WORKOUT_BLOCK_TYPES.join(", ")}`;
  }

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return "title is required";

  const scoreType = b.scoreType ?? "none";
  if (!isWorkoutScoreType(scoreType)) {
    return `scoreType must be one of: ${WORKOUT_SCORE_TYPES.join(", ")}`;
  }

  const stringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];

  return {
    blockType,
    title,
    description: typeof b.description === "string" ? b.description.trim() || null : null,
    scoreType,
    blockOrder: Number.isInteger(b.blockOrder) ? (b.blockOrder as number) : undefined,
    rounds: typeof b.rounds === "number" && Number.isFinite(b.rounds) ? b.rounds : null,
    rep_scheme: typeof b.rep_scheme === "string" ? b.rep_scheme.trim() || null : null,
    time_domain_seconds:
      typeof b.time_domain_seconds === "number" && Number.isFinite(b.time_domain_seconds)
        ? Math.round(b.time_domain_seconds)
        : null,
    stimulus: stringArray(b.stimulus),
    modality: stringArray(b.modality),
    equipment: stringArray(b.equipment),
    tags: stringArray(b.tags),
  };
}

export async function POST(request: Request) {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const isMember = await isOrgMember(userId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, "", "admin");
  if (!canWrite) {
    return NextResponse.json(
      { error: `Admin role required (you are: ${role}).` },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const trackName =
    typeof (body as { trackName?: unknown }).trackName === "string"
      ? (body as { trackName: string }).trackName.trim()
      : "Fitness";
  const dryRun = Boolean((body as { dryRun?: unknown }).dryRun);
  const rawDays = (body as { days?: unknown }).days;

  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    return NextResponse.json({ error: "days[] is required and must be non-empty." }, { status: 400 });
  }

  const { data: track, error: trackError } = await supabaseAdmin
    .from("programming_tracks")
    .select("id, name")
    .ilike("name", trackName)
    .maybeSingle();

  if (trackError) {
    return NextResponse.json({ error: "Failed to look up track." }, { status: 500 });
  }
  if (!track?.id) {
    return NextResponse.json(
      { error: `Track named "${trackName}" not found. Create it first or pass an existing trackName.` },
      { status: 404 }
    );
  }

  const imported: ImportedBlockResult[] = [];
  const skipped: SkippedBlockResult[] = [];

  for (const rawDay of rawDays) {
    if (!rawDay || typeof rawDay !== "object") {
      skipped.push({ date: "", reason: "day entry is not an object" });
      continue;
    }
    const d = rawDay as Record<string, unknown>;
    const date = typeof d.date === "string" ? d.date.trim() : "";
    if (!isValidDate(date)) {
      skipped.push({ date, reason: "date must be YYYY-MM-DD" });
      continue;
    }
    const dayTitle = typeof d.title === "string" ? d.title.trim() || null : null;
    const dayNotes = typeof d.notes === "string" ? d.notes.trim() || null : null;
    const rawBlocks = Array.isArray(d.blocks) ? d.blocks : [];
    if (rawBlocks.length === 0) {
      skipped.push({ date, reason: "no blocks for day" });
      continue;
    }

    const parsedBlocks: IncomingBlock[] = [];
    rawBlocks.forEach((rb, idx) => {
      const parsed = parseBlock(rb);
      if (typeof parsed === "string") {
        skipped.push({ date, reason: `block[${idx}]: ${parsed}` });
      } else {
        parsedBlocks.push(parsed);
      }
    });
    if (parsedBlocks.length === 0) continue;

    if (dryRun) {
      parsedBlocks.forEach((b) =>
        imported.push({ date, blockType: b.blockType, title: b.title, blockId: "dry-run" })
      );
      continue;
    }

    const { data: dayRow, error: dayError } = await supabaseAdmin
      .from("programming_days")
      .upsert(
        {
          track_id: track.id,
          day_date: date,
          title: dayTitle,
          notes: dayNotes,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "track_id,day_date" }
      )
      .select("id")
      .single();

    if (dayError || !dayRow?.id) {
      skipped.push({ date, reason: `day upsert failed: ${dayError?.message ?? "unknown"}` });
      continue;
    }

    const { data: existingBlocks } = await supabaseAdmin
      .from("workout_blocks")
      .select("block_order")
      .eq("programming_day_id", dayRow.id)
      .order("block_order", { ascending: false })
      .limit(1);

    let nextOrder =
      Array.isArray(existingBlocks) && existingBlocks.length > 0
        ? (existingBlocks[0].block_order ?? 0) + 1
        : 0;

    for (const b of parsedBlocks) {
      const order = Number.isInteger(b.blockOrder) ? (b.blockOrder as number) : nextOrder++;
      const { data: blockRow, error: blockError } = await supabaseAdmin
        .from("workout_blocks")
        .insert({
          programming_day_id: dayRow.id,
          track_id: track.id,
          block_order: order,
          block_type: b.blockType,
          title: b.title,
          description: b.description ?? null,
          score_type: b.scoreType ?? "none",
          rounds: b.rounds ?? null,
          rep_scheme: b.rep_scheme ?? null,
          time_domain_seconds: b.time_domain_seconds ?? null,
          stimulus: b.stimulus ?? [],
          modality: b.modality ?? [],
          equipment: b.equipment ?? [],
          tags: b.tags ?? [],
          source: "chalkitpro",
          created_by: userId,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (blockError || !blockRow?.id) {
        skipped.push({
          date,
          blockType: b.blockType,
          title: b.title,
          reason: `insert failed: ${blockError?.message ?? "unknown"}`,
        });
        continue;
      }

      imported.push({ date, blockType: b.blockType, title: b.title, blockId: blockRow.id });
    }
  }

  return NextResponse.json(
    {
      trackId: track.id,
      trackName: track.name,
      dryRun,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped,
    },
    { status: 200 }
  );
}
