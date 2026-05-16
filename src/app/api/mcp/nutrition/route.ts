import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import {
  isAuthorizedAgentBearerRequest,
  isAuthorizedAgentRequest,
  isAuthorizedAgentUrlTokenRequest,
} from "@/lib/agent-auth";
import {
  getOriginFromRequest,
  verifyMcpAccessToken,
} from "@/lib/mcp-oauth";
import { createNutritionMcpServer } from "@/lib/nutrition-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withCorsHeaders(response: Response) {
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", "*");
  next.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  next.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-agent-token, mcp-protocol-version, mcp-session-id, Last-Event-ID"
  );
  next.headers.set("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
  return next;
}

function isAuthorized(request: Request, expectedToken: string) {
  return (
    isAuthorizedAgentBearerRequest(request, expectedToken) ||
    isAuthorizedAgentRequest(request, expectedToken) ||
    isAuthorizedAgentUrlTokenRequest(request, expectedToken)
  );
}

function getLegacyAgentConfig() {
  const token = process.env.AGENT_NUTRITION_TOKEN?.trim() ?? "";
  const memberId = process.env.AGENT_MEMBER_ID?.trim() ?? "";
  return { token, memberId };
}

function getOAuthMemberId(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() === "bearer" && token) {
    try {
      const oauthAccess = verifyMcpAccessToken(token);
      if (oauthAccess?.memberId) {
        return oauthAccess.memberId;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getAuthorizedMemberId(request: Request) {
  const oauthMemberId = getOAuthMemberId(request);
  if (oauthMemberId) {
    return oauthMemberId;
  }

  const { token, memberId } = getLegacyAgentConfig();
  if (!token || !memberId) {
    return null;
  }

  return isAuthorized(request, token) ? memberId : null;
}

function unauthorizedResponse(request: Request) {
  const resourceMetadataUrl = `${getOriginFromRequest(request)}/.well-known/oauth-protected-resource/api/mcp/nutrition`;
  return withCorsHeaders(
    new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
      },
    })
  );
}

async function handleMcpRequest(request: Request) {
  const authorizedMemberId = getAuthorizedMemberId(request);
  if (!authorizedMemberId) {
    return unauthorizedResponse(request);
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  const server = createNutritionMcpServer(authorizedMemberId);
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}

export async function OPTIONS() {
  return withCorsHeaders(
    new Response(null, {
      status: 204,
    })
  );
}

export async function GET(request: Request) {
  if (!getAuthorizedMemberId(request)) {
    return unauthorizedResponse(request);
  }

  return withCorsHeaders(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST, OPTIONS",
        },
      }
    )
  );
}

export async function POST(request: Request) {
  return withCorsHeaders(await handleMcpRequest(request));
}

export async function DELETE(request: Request) {
  if (!getAuthorizedMemberId(request)) {
    return unauthorizedResponse(request);
  }

  return withCorsHeaders(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST, OPTIONS",
        },
      }
    )
  );
}
