import { NextResponse } from "next/server";

import { requireRequestUserContext } from "@/lib/member";
import { isLiftDate, validateLiftSets } from "@/lib/lift-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId } = await requireRequestUserContext(request);
  if (error || !userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dayDate = new URL(request.url).searchParams.get("dayDate") ?? "";
  if (!isLiftDate(dayDate))
    return NextResponse.json(
      { error: "A valid dayDate is required." },
      { status: 400 },
    );
  const { data, error: fetchError } = await supabaseAdmin
    .from("athlete_lift_logs")
    .select(
      "id, day_date, notes, movement_library(name), athlete_lift_log_sets(set_order, reps, weight)",
    )
    .eq("member_id", userId)
    .eq("day_date", dayDate)
    .order("created_at", { ascending: true });
  if (fetchError)
    return NextResponse.json(
      { error: "Unable to load your lifts." },
      { status: 500 },
    );
  const logs = (data ?? []).map((log) => {
    const movement = Array.isArray(log.movement_library)
      ? log.movement_library[0]
      : log.movement_library;
    return {
      id: log.id,
      dayDate: log.day_date,
      notes: log.notes,
      movementName: movement?.name ?? "Lift",
      sets: [...(log.athlete_lift_log_sets ?? [])].sort(
        (a, b) => a.set_order - b.set_order,
      ),
    };
  });
  return NextResponse.json({ logs });
}

export async function POST(request: Request) {
  const { error, userId } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const movementId =
    typeof body?.movementId === "string" ? body.movementId : "";
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const sets: unknown = body?.sets;

  if (!movementId || !isLiftDate(dayDate)) {
    return NextResponse.json(
      { error: "movementId and dayDate are required." },
      { status: 400 },
    );
  }

  if (!validateLiftSets(sets)) {
    return NextResponse.json(
      {
        error:
          "Enter 1–100 complete sets with whole-number reps and a positive weight.",
      },
      { status: 400 },
    );
  }
  const { data: movement, error: movementError } = await supabaseAdmin
    .from("movement_library")
    .select("id")
    .eq("id", movementId)
    .maybeSingle();
  if (movementError || !movement) {
    return NextResponse.json(
      { error: "Select a movement from the library." },
      { status: 400 },
    );
  }

  const { data: log, error: insertError } = await supabaseAdmin
    .from("athlete_lift_logs")
    .insert({
      member_id: userId,
      movement_id: movementId,
      day_date: dayDate,
      notes,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !log?.id) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create log." },
      { status: 500 },
    );
  }

  if (sets.length > 0) {
    const setRows = sets.map((s, i) => ({
      log_id: log.id,
      set_order: i + 1,
      reps: s.reps,
      weight: s.weight,
      updated_at: new Date().toISOString(),
    }));
    const { error: setError } = await supabaseAdmin
      .from("athlete_lift_log_sets")
      .insert(setRows);
    if (setError) {
      const { error: cleanupError } = await supabaseAdmin
        .from("athlete_lift_logs")
        .delete()
        .eq("id", log.id)
        .eq("member_id", userId);
      if (cleanupError)
        console.error("Failed to remove incomplete lift log", log.id);
      return NextResponse.json(
        {
          error: cleanupError
            ? "The lift could not be completed. Please contact support before retrying."
            : "Unable to save sets. Please try again.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ id: log.id }, { status: 201 });
}
