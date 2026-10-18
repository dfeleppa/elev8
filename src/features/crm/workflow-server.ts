import "server-only";
import { NextResponse } from "next/server";
import { capabilitiesForRole } from "./contracts";
import { allowsMutationOrigin, requireClientContext } from "./context";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const privateHeaders = { "Cache-Control": "private, no-store" };
export const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders });
export async function workflowGate(request: Request, mutate = false) {
  const ctx = await requireClientContext(request);
  if (ctx.error || !ctx.userId) return reply({ error: "Unauthorized" }, 401);
  if (!capabilitiesForRole(ctx.role).crm) return reply({ error: "Forbidden" }, 403);
  if (mutate && !allowsMutationOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  return ctx;
}
export async function validStaff(id: string | null) {
  if (id === null) return true;
  const { data, error } = await supabaseAdmin.from("app_users").select("id").eq("id", id).in("role", ["admin", "owner"]).not("supabase_auth_uid", "is", null).maybeSingle();
  return !error && Boolean(data);
}
