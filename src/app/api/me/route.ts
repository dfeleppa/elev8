import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";

export const runtime = "nodejs";

export async function GET() {
  const { error, userId, role, organizationIds } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    userId,
    role,
    organizationIds,
  });
}
