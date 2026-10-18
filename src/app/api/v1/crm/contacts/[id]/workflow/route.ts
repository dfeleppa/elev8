import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { workflowInput } from "@/features/crm/workflow-contracts";
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
