import { NextResponse } from "next/server";

import { createRegisteredMcpClient } from "@/lib/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withCors(response: Response) {
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", "*");
  next.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  next.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return next;
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          client_name?: string;
          redirect_uris?: string[];
          scope?: string;
          token_endpoint_auth_method?: string;
        }
      | null;

    if (!body) {
      return withCors(NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 }));
    }

    const client = createRegisteredMcpClient(body);
    return withCors(NextResponse.json(client, { status: 201 }));
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          error: "invalid_client_metadata",
          error_description: error instanceof Error ? error.message : "Invalid client metadata.",
        },
        { status: 400 }
      )
    );
  }
}

