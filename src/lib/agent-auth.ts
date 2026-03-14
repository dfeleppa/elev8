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
