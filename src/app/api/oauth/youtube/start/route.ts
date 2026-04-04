import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import {
  getYoutubeAuthUrl,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "../../../../../lib/youtube";

export const runtime = "nodejs";

export async function GET() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = randomBytes(24).toString("hex");
  const url = getYoutubeAuthUrl(state);
  const response = NextResponse.redirect(url);

  response.cookies.set({
    name: YOUTUBE_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
