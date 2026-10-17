import { NextResponse } from "next/server";
import { requireClientContext } from "@/features/crm/context";
import { capabilitiesForRole } from "@/features/crm/contracts";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const ctx = await requireClientContext(request);
  if (ctx.error || !ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ userId: ctx.userId, role: ctx.role, capabilities: capabilitiesForRole(ctx.role) },
    { headers: { "Cache-Control": "private, no-store" } });
}
