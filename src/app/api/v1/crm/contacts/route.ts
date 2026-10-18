import { NextResponse } from "next/server";
import { z } from "zod";
import { allowsMutationOrigin, requireClientContext } from "@/features/crm/context";
import { capabilitiesForRole, contactInput } from "@/features/crm/contracts";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const fields = "id, full_name, email, phone, source, created_at";
const headers = { "Cache-Control": "private, no-store" };

async function gate(request: Request) {
  const ctx = await requireClientContext(request);
  if (ctx.error || !ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (!capabilitiesForRole(ctx.role).crm) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  return ctx;
}

export async function GET(request: Request) {
  const ctx = await gate(request);
  if (ctx instanceof NextResponse) return ctx;
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  const search = params.get("q")?.trim() ?? "";
  if (search.length > 100 || /[^\p{L}\p{N}\s@.+_\-]/u.test(search)) return NextResponse.json({ error: "Use a name, email or phone to search (up to 100 characters)." }, { status: 400, headers });
  if (cursor && !z.string().uuid().safeParse(cursor).success) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400, headers });
  }
  // UUID ordering is stable even when new contacts are inserted between pages.
  let query = supabaseAdmin.from("crm_contacts").select(fields).order("id").limit(51);
  if (cursor) query = query.gt("id", cursor);
  if (search) {
    const pattern = `%${search.replace(/_/g, "\\_")}%`;
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Contacts are unavailable. Please try again later." }, { status: 503, headers });
  const contacts = (data ?? []).slice(0, 50);
  return NextResponse.json({ contacts, nextCursor: (data?.length ?? 0) > 50 ? contacts[49].id : null }, { headers });
}

export async function POST(request: Request) {
  const ctx = await gate(request);
  if (ctx instanceof NextResponse) return ctx;
  if (!allowsMutationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  const parsed = contactInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name and a valid email or international phone number." }, { status: 400, headers });
  const { data, error } = await supabaseAdmin.from("crm_contacts").insert({
    ...parsed.data, email: parsed.data.email || null, phone: parsed.data.phone || null, created_by: ctx.userId,
  }).select(fields).single();
  if (error?.code === "23505") return NextResponse.json({ error: "This contact was already saved. Refresh the list." }, { status: 409, headers });
  if (error) return NextResponse.json({ error: "Could not save the contact. Please try again later." }, { status: 503, headers });
  return NextResponse.json({ contact: data }, { status: 201, headers });
}
