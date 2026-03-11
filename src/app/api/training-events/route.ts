import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("training_events")
    .select("id, name, event_date, created_at, updated_at")
    .eq("member_id", userId)
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const eventDate = typeof body?.eventDate === "string" ? body.eventDate : "";

  if (!name || !isValidDate(eventDate)) {
    return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("training_events")
    .insert({
      member_id: userId,
      name,
      event_date: eventDate,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, event_date, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data }, { status: 201 });
}
