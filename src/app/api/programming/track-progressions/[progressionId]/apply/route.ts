import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../../../lib/member";
import { hasOrgRole } from "../../../../../../lib/programming-access";
import { formatDuration, formatDistance } from "../../../../../../lib/programs";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/programming/track-progressions/[progressionId]/apply
// Creates workout_blocks on the calendar for each non-off week in the progression.
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ progressionId: string }> }
) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { progressionId } = await params;

  // Load the progression.
  const { data: progression, error: progError } = await supabaseAdmin
    .from("track_progressions")
    .select("*")
    .eq("id", progressionId)
    .single();

  if (progError || !progression) {
    return NextResponse.json({ error: "Progression not found." }, { status: 404 });
  }

  const admin = await hasOrgRole(userId, progression.organization_id, "admin");
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load source block to copy block_type, score_type, title.
  const { data: sourceBlock, error: blockError } = await supabaseAdmin
    .from("workout_blocks")
    .select("id, title, block_type, score_type, programming_day_id")
    .eq("id", progression.source_block_id)
    .single();

  if (blockError || !sourceBlock) {
    return NextResponse.json({ error: "Source block not found." }, { status: 404 });
  }

  // Load weeks, skip off weeks.
  const { data: weeks, error: weeksError } = await supabaseAdmin
    .from("track_progression_weeks")
    .select("*")
    .eq("progression_id", progressionId)
    .neq("week_type", "off")
    .order("week_number", { ascending: true });

  if (weeksError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const activeWeeks = weeks ?? [];
  const createdDates: string[] = [];

  for (const week of activeWeeks) {
    const targetDate = addDays(progression.start_date, (week.week_number - 1) * 7);
    const isDeload = week.week_type === "deload";

    // Upsert programming_day for this date + track.
    const { data: day, error: dayError } = await supabaseAdmin
      .from("programming_days")
      .upsert(
        {
          organization_id: progression.organization_id,
          track_id: progression.track_id,
          day_date: targetDate,
          title: null,
          notes: null,
          is_published: false,
        },
        { onConflict: "organization_id,track_id,day_date" }
      )
      .select("id")
      .single();

    if (dayError || !day) {
      // Skip this week rather than failing the whole apply.
      continue;
    }

    const blockTitle = isDeload
      ? `${sourceBlock.title} — Deload`
      : sourceBlock.title;

    const description = buildDescription(week, progression.category);

    // Determine next block_order for this day.
    const { count } = await supabaseAdmin
      .from("workout_blocks")
      .select("id", { count: "exact", head: true })
      .eq("programming_day_id", day.id);

    const blockOrder = count ?? 0;

    const { error: insertError } = await supabaseAdmin
      .from("workout_blocks")
      .insert({
        programming_day_id: day.id,
        organization_id: progression.organization_id,
        block_order: blockOrder,
        block_type: sourceBlock.block_type,
        title: blockTitle,
        description,
        score_type: sourceBlock.score_type,
        leaderboard_enabled: false,
        benchmark_enabled: false,
        tags: [],
      });

    if (!insertError) {
      createdDates.push(targetDate);
    }
  }

  return NextResponse.json({ created: createdDates.length, dates: createdDates });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDescription(week: Record<string, unknown>, category: string): string {
  if (category === "lift") {
    return buildLiftDescription(week);
  }
  return buildConditioningDescription(week);
}

function buildLiftDescription(week: Record<string, unknown>): string {
  const sets = week.sets as number | null;
  const reps = week.reps as string | null;
  const progressionType = week.progression_type as string | null;
  const percentOfMax = week.percent_of_max as number | null;
  const rpeTarget = week.rpe_target as number | null;
  const weightIncrement = week.weight_increment as number | null;
  const startingWeight = week.starting_weight as number | null;
  const notes = week.notes as string | null;

  const setsReps = sets && reps ? `${sets} × ${reps}` : reps ? reps : sets ? `${sets} sets` : "";

  let intensity = "";
  if (progressionType === "percentage" && percentOfMax != null) {
    intensity = ` @ ${percentOfMax}% 1RM`;
  } else if (progressionType === "rpe" && rpeTarget != null) {
    intensity = ` @ RPE ${rpeTarget}`;
  } else if (progressionType === "linear_weight") {
    if (startingWeight != null && weightIncrement != null) {
      const weekWeight = startingWeight + (((week.week_number as number) - 1) * weightIncrement);
      intensity = ` @ ${weekWeight} lbs`;
    } else if (startingWeight != null) {
      intensity = ` @ ${startingWeight} lbs`;
    }
  }

  const lines: string[] = [];
  if (setsReps || intensity) lines.push(`<p>${setsReps}${intensity}</p>`);
  if (notes) lines.push(`<p>${notes}</p>`);
  return lines.join("") || "";
}

function buildConditioningDescription(week: Record<string, unknown>): string {
  const modality = week.modality as string | null;
  const conditioningType = week.conditioning_type as string | null;
  const distanceMeters = week.distance_meters as number | null;
  const durationSeconds = week.duration_seconds as number | null;
  const intervalCount = week.interval_count as number | null;
  const intervalDistanceMeters = week.interval_distance_meters as number | null;
  const intervalRestSeconds = week.interval_rest_seconds as number | null;
  const notes = week.notes as string | null;

  const modalityLabel = modality ? modality.charAt(0).toUpperCase() + modality.slice(1) : "";

  let prescription = "";
  if (conditioningType === "distance" && distanceMeters != null) {
    prescription = `${formatDistance(distanceMeters)} ${modalityLabel}`.trim();
  } else if (conditioningType === "time" && durationSeconds != null) {
    prescription = `${formatDuration(durationSeconds)} ${modalityLabel}`.trim();
  } else if (conditioningType === "intervals") {
    const parts: string[] = [];
    if (intervalCount != null) parts.push(`${intervalCount}×`);
    if (intervalDistanceMeters != null) parts.push(formatDistance(intervalDistanceMeters));
    if (modalityLabel) parts.push(modalityLabel);
    if (intervalRestSeconds != null) parts.push(`rest ${formatDuration(intervalRestSeconds)}`);
    prescription = parts.join(" ");
  }

  const lines: string[] = [];
  if (prescription) lines.push(`<p>${prescription}</p>`);
  if (notes) lines.push(`<p>${notes}</p>`);
  return lines.join("") || "";
}
