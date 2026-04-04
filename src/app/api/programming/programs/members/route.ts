import { NextResponse } from "next/server";

import { hasOrgRole } from "../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

/**
 * Returns members of the caller's organization.
 * Accessible to admin/owner — used by the program assignment panel.
 */
export async function GET(request: Request) {
  const { error, userId, organizationIds } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? organizationIds[0] ?? null;

  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canRead = await hasOrgRole(userId, organizationId, "admin");
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("organization_memberships")
    .select("user_id, role, app_users!inner(id, full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const members = (data ?? []).map((row) => {
    const user = Array.isArray(row.app_users) ? row.app_users[0] : row.app_users;
    return {
      id: user?.id ?? row.user_id,
      full_name: user?.full_name ?? null,
      email: user?.email ?? "",
      role: row.role,
    };
  });

  return NextResponse.json({ members });
}
