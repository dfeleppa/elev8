import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { isOrgMember } from "../../../../lib/programming-access";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
  }

  const isMember = await isOrgMember(userId, organizationId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("movement_library")
    .select("id, name, modality, default_unit")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ movements: data ?? [] });
}
