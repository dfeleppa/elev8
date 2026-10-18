"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { stages, type ContactDetail } from "./workflow-contracts";
import { CreationAttempts, saveCreation } from "./creation-attempt";

const field = "block w-full rounded-lg border border-white/20 bg-slate-900 p-2";
export default function ContactWorkflow({ id, close }: { id: string; close: () => void }) {
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pending = useRef(new CreationAttempts());
  async function load() {
    const response = await fetch(`/api/v1/crm/contacts/${id}/workflow`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) setDetail(null);
      throw Object.assign(new Error(body.error), { status: response.status });
    }
    setDetail(body);
    return body as ContactDetail;
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/crm/contacts/${id}/workflow`, { cache: "no-store" }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (active) setDetail(body);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);
  async function save(values: Record<string, unknown>, form?: HTMLFormElement, edit = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    const action = String(values.action || "edit");
    try {
      const send = (payload: Record<string, unknown>) => fetch(`/api/v1/crm/contacts/${id}/workflow`, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (["note", "opportunity", "task"].includes(action)) {
        const result = await saveCreation(pending.current, values, send, load);
        form?.reset();
        if (result.refreshError) setError("Saved. The updated contact could not be refreshed. Refresh to see the saved record.");
      } else {
        const response = await send(values);
        if (!response.ok) {
          const body = await response.json();
          if (response.status === 409) await load();
          throw Object.assign(new Error(body.error), { status: response.status });
        }
        form?.reset();
        try { await load(); } catch { setError("Saved. The updated contact could not be refreshed. Refresh to see the saved record."); }
      }
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && (e.status === 401 || e.status === 403)) setDetail(null);
      setError(e instanceof Error ? e.message : "Could not save.");
    }
    finally { lock.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    if (action === "task") { values.due_at = new Date(String(values.due_at)).toISOString(); }
    void save({ ...values, action, ...(action === "task" ? { assignee_id: values.assignee_id || null, opportunity_id: values.opportunity_id || null } : {}), ...(action === "opportunity" ? { owner_id: values.owner_id || null, value_cents: Number(values.value_cents) } : {}) }
      // Only send fields belonging to the chosen action.
      , form);
  }
  const staff = <><option value="">Unassigned</option>{detail?.staff.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}</>;
  return <section className="glass-panel space-y-6 rounded-2xl p-6" aria-busy={busy}>
    <button type="button" onClick={close} className="underline">Close detail</button>
    {error && <p role="alert" className="text-red-300">{error} <button type="button" onClick={() => void load().catch(e => setError(e.message))}>Refresh</button></p>}
    {!detail ? <p>Loading contact…</p> : <>
      <h2 className="text-xl font-semibold">{detail.contact.full_name}</h2>
      {detail.truncated && <p role="status">Showing up to 100 items per section. Older records may be omitted.</p>}
      <form key={detail.contact.version} onSubmit={e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)); void save({ ...v, id, owner_id: v.owner_id || null, expected_version: detail.contact.version }, undefined, true); }}>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label>Name<input className={field} name="full_name" defaultValue={detail.contact.full_name} required maxLength={160}/></label>
          <label>Email<input className={field} name="email" type="email" defaultValue={detail.contact.email || ""}/></label>
          <label>International phone<input className={field} name="phone" defaultValue={detail.contact.phone || ""}/></label>
          <label>Source<select className={field} name="source" defaultValue={detail.contact.source}>{["manual", "referral", "website", "import"].map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Contact owner<select className={field} name="owner_id" defaultValue={detail.contact.owner_id || ""}>{staff}</select></label>
          <button className="rounded bg-cyan-200 p-2 text-slate-950">Save contact details</button>
        </fieldset>
      </form>
      <h3 className="text-lg font-semibold">Staff notes</h3>
      <form onSubmit={e => { e.preventDefault(); void save({ action: "note", body: new FormData(e.currentTarget).get("body") }, e.currentTarget); }}><fieldset disabled={busy} className="space-y-2"><label>New note<textarea className={field} name="body" required maxLength={5000}/></label><button className="underline">Add note</button></fieldset></form>
      <ul>{detail.notes.map(n => <li className="border-b border-white/10 py-3" key={n.id}><p className="whitespace-pre-wrap">{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></li>)}</ul>
      <h3 className="text-lg font-semibold">Opportunities</h3>
      {detail.opportunities.map(o => <div key={o.id} className="space-y-2 rounded border border-white/15 p-3"><strong>{o.title}</strong><label className="block">Stage<select aria-label={`Stage for ${o.title}`} className={field} disabled={busy} value={o.stage} onChange={e => void save({ action: "stage", id: o.id, stage: e.target.value, expected_version: o.version })}>{stages.map(s => <option key={s}>{s}</option>)}</select></label>
        <form key={o.version} onSubmit={e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)); void save({ ...v, action: "opportunity_edit", id: o.id, owner_id: v.owner_id || null, value_cents: Number(v.value_cents), expected_version: o.version }); }}><fieldset disabled={busy} className="space-y-2"><label>Assigned staff<select className={field} name="owner_id" defaultValue={o.owner_id || ""}>{staff}</select></label><label>Value (USD cents)<input className={field} type="number" min={0} max={100000000} step={1} name="value_cents" defaultValue={o.value_cents}/></label><label>Next action<input className={field} name="next_action" maxLength={500} defaultValue={o.next_action}/></label><button className="underline">Save opportunity</button></fieldset></form>
      </div>)}
      <form onSubmit={e => submit(e, "opportunity")}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label>Opportunity title<input className={field} name="title" required maxLength={160}/></label><label>Assigned staff<select name="owner_id" className={field}>{staff}</select></label><label>Value (USD cents)<input className={field} type="number" name="value_cents" min={0} max={100000000} step={1} defaultValue={0}/></label><label>Next action<input className={field} name="next_action" maxLength={500}/></label><button className="underline">Add opportunity</button></fieldset></form>
      <h3 className="text-lg font-semibold">Follow-up tasks</h3>
      <ul className="space-y-3">{detail.tasks.map(t => <li key={t.id}><label><input type="checkbox" disabled={busy} checked={t.completed} onChange={e => void save({ action: "task_status", id: t.id, completed: e.target.checked, expected_version: t.version })}/> {t.title}</label><p className={!t.completed && new Date(t.due_at).getTime() < Date.now() ? "text-amber-300" : "text-slate-400"}>{new Date(t.due_at).toLocaleString()} · {detail.staff.find(s => s.id === t.assignee_id)?.name || "Unassigned"}</p></li>)}</ul>
      <form onSubmit={e => submit(e, "task")}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label>Follow-up<input className={field} name="title" required maxLength={240}/></label><label>Due date<input className={field} type="datetime-local" name="due_at" required/></label><label>Responsible staff<select className={field} name="assignee_id">{staff}</select></label><label>Opportunity<select className={field} name="opportunity_id"><option value="">Contact only</option>{detail.opportunities.map(o => <option value={o.id} key={o.id}>{o.title}</option>)}</select></label><button className="underline">Add follow-up</button></fieldset></form>
      <details><summary>Stage history</summary><ul>{detail.stage_events.map(e => <li key={e.id}>{detail.opportunities.find(o => o.id === e.opportunity_id)?.title || "Opportunity"}: {e.from_stage || "Created"} → {e.to_stage} · {new Date(e.created_at).toLocaleString()}</li>)}</ul></details>
    </>}
  </section>;
}
