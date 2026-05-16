import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAgentConfig() {
  const token = process.env.AGENT_NUTRITION_TOKEN?.trim() ?? "";
  const memberId = process.env.AGENT_MEMBER_ID?.trim() ?? "";

  if (!token || !memberId) {
    return {
      errorResponse: NextResponse.json(
        { error: "Agent access is not configured." },
        { status: 500 }
      ),
      token: "",
      memberId: "",
    };
  }

  return {
    errorResponse: null,
    token,
    memberId,
  };
}

export function isAuthorizedAgentRequest(request: Request, expectedToken: string) {
  const headerToken = request.headers.get("x-agent-token")?.trim() ?? "";
  if (!headerToken || !expectedToken) {
    return false;
  }
  return constantTimeEqual(headerToken, expectedToken);
}

export function isAuthorizedAgentBearerRequest(request: Request, expectedToken: string) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token || !expectedToken) {
    return false;
  }

  return constantTimeEqual(token, expectedToken);
}

export function isAuthorizedAgentUrlTokenRequest(request: Request, expectedToken: string) {
  if (!expectedToken) {
    return false;
  }

  const url = new URL(request.url);
  const token =
    url.searchParams.get("agentToken")?.trim() ??
    url.searchParams.get("access_token")?.trim() ??
    url.searchParams.get("token")?.trim() ??
    "";

  if (!token) {
    return false;
  }

  return constantTimeEqual(token, expectedToken);
}
