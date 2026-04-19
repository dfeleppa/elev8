import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: gym, error: fetchError } = await supabaseAdmin
    .from("gym_settings")
    .select("name, logo_url, address, phone, email")
    .eq("id", 1)
    .single();

  if (fetchError || !gym) {
    return NextResponse.json({ error: "Gym settings not found." }, { status: 404 });
  }

  return NextResponse.json({
    name: gym.name,
    logoUrl: gym.logo_url,
    address: gym.address,
    phone: gym.phone,
    email: gym.email,
  });
}

export async function PATCH(request: Request) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const updates: Record<string, string | null> = {};
  if ("name" in body) updates.name = body.name;
  if ("address" in body) updates.address = body.address ?? null;
  if ("phone" in body) updates.phone = body.phone ?? null;
  if ("email" in body) updates.email = body.email ?? null;
  updates.updated_at = new Date().toISOString();

  const { data: gym, error: updateError } = await supabaseAdmin
    .from("gym_settings")
    .update(updates)
    .eq("id", 1)
    .select("name, logo_url, address, phone, email")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }

  return NextResponse.json({
    name: gym.name,
    logoUrl: gym.logo_url,
    address: gym.address,
    phone: gym.phone,
    email: gym.email,
  });
}
