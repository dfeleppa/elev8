import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { getYoutubeAuthUrl } from "../../../../../lib/youtube";

export const runtime = "nodejs";

export async function GET() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = getYoutubeAuthUrl();
  return NextResponse.redirect(url);
}
