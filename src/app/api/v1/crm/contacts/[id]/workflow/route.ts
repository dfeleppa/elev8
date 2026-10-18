import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactEditInput, workflowInput } from "@/features/crm/workflow-contracts";
import { reply, validStaff, workflowGate } from "@/features/crm/workflow-server";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await workflowGate(request, true);
  if (ctx instanceof NextResponse) return ctx;
  const { id: contactId } = await context.params;
  const parsed = workflowInput.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(contactId).success || !parsed.success) return reply({ error: "Invalid workflow details." }, 400);
  const input = parsed.data;
  const contact = await supabaseAdmin.from("crm_contacts").select("id").eq("id", contactId).maybeSingle();
  if (contact.error) return reply({ error: "Contact unavailable." }, 503);
  if (!contact.data) return reply({ error: "Contact not found." }, 404);
  if (((input.action === "opportunity" || input.action === "opportunity_edit") && !await validStaff(input.owner_id)) || (input.action === "task" && !await validStaff(input.assignee_id))) return reply({ error: "Choose an authorized CRM staff member." }, 400);
  let result;
  if (input.action === "stage" || input.action === "task_status" || input.action === "opportunity_edit") {
    const table = input.action === "task_status" ? "crm_tasks" : "crm_opportunities";
    const values = input.action === "stage" ? { stage: input.stage, updated_by: ctx.userId } : input.action === "opportunity_edit" ? { owner_id: input.owner_id, next_action: input.next_action, value_cents: input.value_cents, updated_by: ctx.userId } : { completed: input.completed, updated_by: ctx.userId };
    result = await supabaseAdmin.from(table).update(values).eq("id", input.id).eq("contact_id", contactId).eq("version", input.expected_version).select("id").maybeSingle();
    if (!result.error && !result.data) return reply({ error: "Record changed or is unavailable. Refresh before saving." }, 409);
  } else {
    const { action, ...values } = input;
    const table = action === "note" ? "crm_notes" : action === "task" ? "crm_tasks" : "crm_opportunities";
    result = await supabaseAdmin.from(table).insert({ ...values, contact_id: contactId, created_by: ctx.userId, ...(action === "note" ? {} : { updated_by: ctx.userId }) }).select("id").single();
  }
  if (result.error?.code === "23505") return reply({ error: "Already saved. Refresh to verify before retrying." }, 409);
  if (result.error?.code === "23503") return reply({ error: "Contact, opportunity or assignment is unavailable." }, 400);
  if (result.error) return reply({ error: "Could not save workflow." }, 503);
  return reply({ saved: true }, 200);
}

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
    supabaseAdmin.from("app_users").select("id, name:full_name").in("role", ["admin", "owner"]).not("supabase_auth_uid", "is", null).order("id").limit(101),
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
  const { expected_version, id: operationId, ...values } = parsed.data;
  void operationId;
  if (!await validStaff(values.owner_id)) return reply({ error: "Choose an authorized CRM staff member." }, 400);
  const { data, error } = await supabaseAdmin.from("crm_contacts").update({ ...values, email: values.email || null, phone: values.phone || null, updated_by: ctx.userId }).eq("id", id).eq("version", expected_version).select("id").maybeSingle();
  if (error) return reply({ error: "Could not update contact." }, 503);
  if (!data) return reply({ error: "Contact changed or is unavailable. Refresh before saving." }, 409);
  return reply({ saved: true });
}
