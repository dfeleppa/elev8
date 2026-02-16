import { NextResponse } from "next/server";

import { getYoutubeAuthUrl } from "../../../../../lib/youtube";

export const runtime = "nodejs";

export async function GET() {
  const url = getYoutubeAuthUrl();
  return NextResponse.redirect(url);
}
