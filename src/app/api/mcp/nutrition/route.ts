import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { getAgentConfig, isAuthorizedAgentBearerRequest, isAuthorizedAgentRequest } from "@/lib/agent-auth";
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
    isAuthorizedAgentRequest(request, expectedToken)
  );
}

async function handleMcpRequest(request: Request) {
  const { errorResponse, token, memberId } = getAgentConfig();
  if (errorResponse) {
    return errorResponse;
  }

  if (!isAuthorized(request, token)) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  const server = createNutritionMcpServer(memberId);
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
  const { errorResponse, token } = getAgentConfig();
  if (errorResponse) {
    return errorResponse;
  }

  if (!isAuthorized(request, token)) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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
  const { errorResponse, token } = getAgentConfig();
  if (errorResponse) {
    return errorResponse;
  }

  if (!isAuthorized(request, token)) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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
