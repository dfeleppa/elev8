import { NextResponse } from "next/server";

import { requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { data, error: fetchError } = await supabaseAdmin
    .from("movement_library")
    .select("id, name, modality, default_unit")
    .order("name", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ movements: data ?? [] });
}
