import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { ensurePlannerSlot, listSocialPosts, startOfWeek, toDateKey } from "@/lib/social";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }
  const weekOfParam = request.nextUrl.searchParams.get("weekOf")?.trim() ?? null;
  const weekOf = weekOfParam || toDateKey(startOfWeek(new Date()));
  const posts = await listSocialPosts({ weekOf, limit: 120 });
  return NextResponse.json({ weekOf, posts });
}

export async function PATCH(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { socialPostId?: string; slotDate?: string; lane?: string; sortOrder?: number }
    | null;

  if (!body || !body.socialPostId || !body.slotDate || !body.lane) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const ok = await ensurePlannerSlot(body.socialPostId, body.slotDate, body.lane, Number(body.sortOrder ?? 0));
  if (!ok) {
    return NextResponse.json({ error: "Failed to update planner slot." }, { status: 500 });
  }

  await supabaseAdmin
    .from("social_posts")
    .update({ workflow_state: body.lane === "scheduled" ? "scheduled" : undefined, updated_at: new Date().toISOString() })
    .eq("id", body.socialPostId);

  return NextResponse.json({ ok: true });
}
