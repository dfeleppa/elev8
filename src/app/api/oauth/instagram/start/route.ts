import { createHmac, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import {
  getInstagramAuthUrl,
  INSTAGRAM_OAUTH_STATE_COOKIE,
} from "../../../../../lib/instagram";

export const runtime = "nodejs";

function createSignedState(organizationId: string) {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for OAuth state signing.");
  }

  const payload = {
    nonce: randomBytes(24).toString("hex"),
    organizationId,
    issuedAt: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export async function GET(request: Request) {
  try {
    const { error, role, organizationIds } = await requireUserContext();
    if (error || !hasRole("admin", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = organizationIds[0] ?? null;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found." }, { status: 400 });
    }

    const stateValue = createSignedState(organizationId);
    const statePayload = JSON.stringify({ state: stateValue, organizationId });
    const url = getInstagramAuthUrl(stateValue);

    const response = NextResponse.redirect(url);
    response.cookies.set({
      name: INSTAGRAM_OAUTH_STATE_COOKIE,
      value: statePayload,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start Instagram OAuth.";
    const redirectUrl = new URL("/organization/admin/content", request.url);
    redirectUrl.searchParams.set("socialError", message);
    return NextResponse.redirect(redirectUrl);
  }
}
