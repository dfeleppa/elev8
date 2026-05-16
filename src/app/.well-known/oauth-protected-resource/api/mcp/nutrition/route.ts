import { NextResponse } from "next/server";

import { getMcpProtectedResourceMetadata, getOriginFromRequest } from "@/lib/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = NextResponse.json(getMcpProtectedResourceMetadata(getOriginFromRequest(request)));
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}
