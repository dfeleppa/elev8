import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  let query = supabaseAdmin
    .from("programming_tracks")
    .select("id, name, code, description, is_active, is_private, number_of_levels, hide_workouts_days_prior, hide_workouts_hour, hide_workouts_minute, created_at, updated_at")
    .order("name", { ascending: true });
  if (!hasRole("coach", role)) {
    query = query.eq("is_active", true).eq("is_private", false);
  }
  const { data, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ tracks: data ?? [] });
}

export async function POST(request: Request) {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  if (!hasRole("admin", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : null;
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const isPrivate = typeof body?.isPrivate === "boolean" ? body.isPrivate : true;
  const numberOfLevels = Number.isFinite(Number(body?.numberOfLevels))
    ? Math.min(3, Math.max(1, Math.trunc(Number(body.numberOfLevels))))
    : 1;
  const hideWorkoutsDaysPrior = Number.isFinite(Number(body?.hideWorkoutsDaysPrior))
    ? Math.max(0, Math.trunc(Number(body.hideWorkoutsDaysPrior)))
    : 0;
  const hideWorkoutsHour = Number.isFinite(Number(body?.hideWorkoutsHour))
    ? Math.min(23, Math.max(0, Math.trunc(Number(body.hideWorkoutsHour))))
    : 0;
  const hideWorkoutsMinute = Number.isFinite(Number(body?.hideWorkoutsMinute))
    ? Math.min(59, Math.max(0, Math.trunc(Number(body.hideWorkoutsMinute))))
    : 0;

  if (!name) {
    return NextResponse.json({ error: "Track name is required." }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("programming_tracks")
    .insert({
      name,
      code,
      description,
      is_private: isPrivate,
      number_of_levels: numberOfLevels,
      hide_workouts_days_prior: hideWorkoutsDaysPrior,
      hide_workouts_hour: hideWorkoutsHour,
      hide_workouts_minute: hideWorkoutsMinute,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, code, description, is_active, is_private, number_of_levels, hide_workouts_days_prior, hide_workouts_hour, hide_workouts_minute, created_at, updated_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ track: data }, { status: 201 });
}

