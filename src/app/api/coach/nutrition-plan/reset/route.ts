import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { preserveMetabolismLearning } from "@/lib/metabolism-learning";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Destructive: only the member themselves or an admin/owner may wipe a plan.
function canResetMember(role: string, currentUserId: string, memberId: string) {
  if (memberId === currentUserId) return true;
  return role === "admin" || role === "owner";
}

export async function POST(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const memberId =
    typeof body?.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : userId;

  if (!canResetMember(role, userId, memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const preserved = await preserveMetabolismLearning(memberId);

    // Full reset: clear all check-in history and the entire plan chain. Weigh-ins,
    // body composition, food logs, and learned metabolism data are intentionally
    // left untouched.
    const { error: checkInError } = await supabaseAdmin
      .from("nutrition_check_ins")
      .delete()
      .eq("member_id", memberId);
    if (checkInError) throw new Error(checkInError.message);

    const { error: planError } = await supabaseAdmin
      .from("coach_nutrition_plans")
      .delete()
      .eq("member_id", memberId);
    if (planError) throw new Error(planError.message);

    return NextResponse.json({ memberId, reset: true, metabolismLearningPreserved: Boolean(preserved) });
  } catch (err) {
    console.error("[nutrition-plan reset POST] failed", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
