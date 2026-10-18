import { NextResponse } from "next/server";
import { z } from "zod";
import { allowsMutationOrigin, requireClientContext } from "@/features/crm/context";

type Context = Awaited<ReturnType<typeof requireClientContext>>;
type Handler = (request: Request, context: Context) => Promise<NextResponse>;
const headers = { "Cache-Control": "private, no-store" };
const profileInput = z.object({ fullName: z.string().trim().min(1).max(150) }).strict();

/** Canonical identity gate. Legacy route handlers never resolve identity for a new client. */
export async function memberRequest(request: Request, handler: Handler) {
  const context = await requireClientContext(request);
  if (context.error || !context.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  let forwarded = request;
  if (request.method !== "GET") {
    if (!allowsMutationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
    const input = await request.json().catch(() => null);
    const parsed = profileInput.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request. Check the fields and try again." }, { status: 400, headers });
    forwarded = new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(parsed.data) });
  }
  const response = await handler(forwarded, context);
  const body = await response.json();
  if (response.ok) {
    return NextResponse.json({ fullName: body.fullName, email: body.email, createdAt: body.createdAt }, { status: response.status, headers });
  }
  return NextResponse.json(body, { status: response.status, headers });
}
