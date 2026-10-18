import type { ContactDetail } from "./workflow-contracts";

/** An unresolved attempt keeps its operation ID, including after a conflict/read failure. */
export class CreationAttempts {
  private ids: Record<string, string> = {};
  prepare(values: Record<string, unknown>, newId: () => string = () => crypto.randomUUID()) {
    const action = String(values.action);
    this.ids[action] ??= newId();
    return { ...values, id: this.ids[action] };
  }
  acknowledge(action: string) { delete this.ids[action]; }
}

export function matchesCreation(detail: ContactDetail, values: Record<string, unknown>): boolean {
  const text = (value: unknown) => String(value ?? "").trim();
  if (values.action === "note") return detail.notes.some(n => n.id === values.id && n.body === text(values.body));
  if (values.action === "opportunity") return detail.opportunities.some(o => o.id === values.id && o.title === text(values.title) && o.owner_id === values.owner_id && o.value_cents === values.value_cents && o.next_action === text(values.next_action));
  if (values.action === "task") return detail.tasks.some(t => t.id === values.id && t.title === text(values.title) && t.assignee_id === values.assignee_id && t.opportunity_id === values.opportunity_id && Date.parse(t.due_at) === Date.parse(String(values.due_at)));
  return false;
}

/** A POST acknowledgement is final even if the subsequent display refresh fails. */
export async function saveCreation(attempts: CreationAttempts, values: Record<string, unknown>, send: (payload: Record<string, unknown>) => Promise<Response>, refresh: () => Promise<ContactDetail>) {
  const payload = attempts.prepare(values);
  const response = await send(payload);
  if (response.ok) {
    attempts.acknowledge(String(values.action));
    try { await refresh(); return { refreshError: null }; }
    catch (error) { return { refreshError: error }; }
  }
  const body = await response.json();
  if (response.status === 409) {
    const detail = await refresh();
    if (matchesCreation(detail, payload)) { attempts.acknowledge(String(values.action)); return { refreshError: null }; }
  }
  throw Object.assign(new Error(body.error || "Could not save. Refresh to verify the existing attempt before retrying."), { status: response.status });
}
