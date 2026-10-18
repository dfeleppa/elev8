import { z } from "zod";
import { contactInput, type Contact } from "./contracts";

export const stages = ["new", "contacted", "consultation", "trial", "won", "lost"] as const;
const id = z.string().uuid();
export const contactEditInput = contactInput.safeExtend({
  owner_id: id.nullable(),
  expected_version: z.number().int().positive(),
});
export const workflowInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("note"), id, body: z.string().trim().min(1).max(5000) }).strict(),
  z.object({ action: z.literal("opportunity"), id, title: z.string().trim().min(1).max(160), owner_id: id.nullable(), value_cents: z.number().int().min(0).max(100000000), next_action: z.string().trim().max(500) }).strict(),
  z.object({ action: z.literal("stage"), id, stage: z.enum(stages), expected_version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("opportunity_edit"), id, owner_id: id.nullable(), next_action: z.string().trim().max(500), value_cents: z.number().int().min(0).max(100000000), expected_version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("task"), id, title: z.string().trim().min(1).max(240), assignee_id: id.nullable(), due_at: z.string().datetime({ offset: true }), opportunity_id: id.nullable() }).strict(),
  z.object({ action: z.literal("task_status"), id, completed: z.boolean(), expected_version: z.number().int().positive() }).strict(),
]);
export type StaffOption = { id: string; name: string | null };
export type Opportunity = { id: string; title: string; stage: typeof stages[number]; owner_id: string | null; value_cents: number; currency: string; next_action: string; version: number };
export type FollowUp = { id: string; title: string; assignee_id: string | null; due_at: string; opportunity_id: string | null; completed: boolean; version: number };
export type ContactDetail = {
  contact: Contact & { owner_id: string | null; version: number };
  staff: StaffOption[];
  notes: { id: string; body: string; created_at: string; created_by: string | null }[];
  opportunities: Opportunity[];
  tasks: FollowUp[];
  stage_events: { id: string; opportunity_id: string; from_stage: string | null; to_stage: string; created_at: string; created_by: string | null }[];
  truncated: boolean;
};
