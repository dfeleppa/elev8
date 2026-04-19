import { NextResponse } from "next/server";

import { hasOrgRole } from "@/lib/programming-access";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(_request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const canRead = await hasOrgRole(userId, "", "admin");
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, email, role")
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const members = (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name ?? null,
    email: row.email ?? "",
    role: row.role,
  }));

  return NextResponse.json({ members });
}
