import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const RICH_SELECT =
  "first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role, status, tracks, last_active, phone, gender, address, birth_date, tags, attendance_count, status_notes";
const BASE_SELECT =
  "first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role";

/**
 * GET /api/owner/members — bearer-authed mirror of the data the
 * /owner/members server page renders, for the iOS app.
 *
 * Falls back to the smaller select shape if the rich columns aren't
 * present (older DBs), matching the web page's resilience.
 */
export async function GET(request: Request) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("owner", role)) {
    return NextResponse.json(
      { error: error ?? "Forbidden" },
      { status: error ? 401 : 403 },
    );
  }

  const rich = await supabaseAdmin
    .from("app_users")
    .select(RICH_SELECT)
    .order("created_at", { ascending: false });

  if (!rich.error) {
    return NextResponse.json({ members: rich.data ?? [] });
  }

  const base = await supabaseAdmin
    .from("app_users")
    .select(BASE_SELECT)
    .order("created_at", { ascending: false });

  if (base.error) {
    return NextResponse.json({ error: base.error.message }, { status: 500 });
  }

  return NextResponse.json({ members: base.data ?? [] });
}
