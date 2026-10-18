import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactEditInput } from "@/features/crm/workflow-contracts";
import { reply, validStaff, workflowGate } from "@/features/crm/workflow-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const ctx = await workflowGate(request);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return reply({ error: "Invalid contact ID." }, 400);
  const contact = await supabaseAdmin.from("crm_contacts").select("id, full_name, email, phone, source, created_at, owner_id, version").eq("id", id).maybeSingle();
  if (contact.error) return reply({ error: "Contact unavailable." }, 503);
  if (!contact.data) return reply({ error: "Contact not found." }, 404);
  const [notes, opportunities, tasks, events, staff] = await Promise.all([
    supabaseAdmin.from("crm_notes").select("id, body, created_at, created_by").eq("contact_id", id).order("created_at", { ascending: false }).order("id").limit(101),
    supabaseAdmin.from("crm_opportunities").select("id, title, stage, owner_id, value_cents, currency, next_action, version").eq("contact_id", id).order("created_at", { ascending: false }).order("id").limit(101),
    supabaseAdmin.from("crm_tasks").select("id, title, assignee_id, due_at, opportunity_id, completed, version").eq("contact_id", id).order("completed").order("due_at").order("id").limit(101),
    supabaseAdmin.from("crm_stage_events").select("id, opportunity_id, from_stage, to_stage, created_at, created_by").eq("contact_id", id).order("created_at", { ascending: false }).order("id").limit(101),
    supabaseAdmin.from("app_users").select("id, name").in("role", ["admin", "owner"]).not("supabase_auth_uid", "is", null).order("id").limit(101),
  ]);
  if ([notes, opportunities, tasks, events, staff].some(r => r.error)) return reply({ error: "Contact workflow unavailable." }, 503);
  return reply({ contact: contact.data, notes: notes.data?.slice(0, 100), opportunities: opportunities.data?.slice(0, 100), tasks: tasks.data?.slice(0, 100), stage_events: events.data?.slice(0, 100), staff: staff.data?.slice(0, 100), truncated: [notes, opportunities, tasks, events, staff].some(r => (r.data?.length ?? 0) > 100) });
}
export async function PATCH(request: Request, context: Context) {
  const ctx = await workflowGate(request, true);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  const parsed = contactEditInput.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success || parsed.data.id !== id) return reply({ error: "Invalid contact details." }, 400);
  const { expected_version, ...values } = parsed.data;
  if (!await validStaff(values.owner_id)) return reply({ error: "Choose an authorized CRM staff member." }, 400);
  const { data, error } = await supabaseAdmin.from("crm_contacts").update({ ...values, email: values.email || null, phone: values.phone || null }).eq("id", id).eq("version", expected_version).select("id").maybeSingle();
  if (error) return reply({ error: "Could not update contact." }, 503);
  if (!data) return reply({ error: "Contact changed or is unavailable. Refresh before saving." }, 409);
  return reply({ saved: true });
}
