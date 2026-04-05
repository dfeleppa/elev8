import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: accounts } = await supabaseAdmin
    .from("social_accounts")
    .select("id, status, action_required, last_synced_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  const updated: string[] = [];
  for (const account of (accounts ?? []) as Array<{ id: string; status: string }>) {
    await supabaseAdmin
      .from("social_accounts")
      .update({
        status: account.status === "disconnected" ? "disconnected" : "connected",
        action_required: null,
        last_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", account.id);
    updated.push(account.id);
  }

  return NextResponse.json({ ok: true, updatedCount: updated.length });
}
