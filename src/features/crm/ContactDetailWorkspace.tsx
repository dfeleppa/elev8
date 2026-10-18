"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { contactETag, type ContactDetail, type ContactDetailResult, type ContactFieldErrors, type ContactPatch } from "./contracts";

type Draft = { full_name: string; email: string; phone: string; source: string };
const draftFor = (contact: ContactDetail): Draft => ({
  full_name: contact.full_name, email: contact.email ?? "", phone: contact.phone ?? "", source: contact.source,
});
const fieldNames = ["full_name", "email", "phone", "source"] as const;
const labels = { full_name: "Name", email: "Email", phone: "Phone", source: "Source" };
type Snapshot = { contact: ContactDetail; etag: string };
const inputStyle = "block w-full rounded-lg border border-white/15 bg-black/20 p-3";

export default function ContactDetailWorkspace({ id }: { id: string }) {
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  const url = `/api/v1/crm/contacts/${id}`;

  function forgetContact() {
    setSaved(null); setDraft(null); setLatest(null); setBlocked(true);
  }

  const load = useCallback(async (preserveDraft: boolean, signal?: AbortSignal) => {
    setLoading(true); setError(null); setNotice(null);
    try {
      const response = await fetch(url, { cache: "no-store", signal });
      const body = await response.json();
      if (signal?.aborted) return;
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) forgetContact();
        throw new Error(body.error || "Could not load contact details.");
      }
      const result = body as ContactDetailResult;
      const snapshot = { contact: result.contact, etag: response.headers.get("etag") || contactETag(result.contact) };
      if (preserveDraft) setLatest(snapshot);
      else {
        setSaved(snapshot); setDraft(draftFor(result.contact)); setLatest(null);
        setBlocked(false); setFieldErrors({});
      }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not load contact details.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [load]);

  const baseline = saved ? draftFor(saved.contact) : null;
  const dirty = Boolean(draft && baseline && fieldNames.some(key => draft[key] !== baseline[key]));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || !draft || !baseline || !dirty || blocked || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(null); setNotice(null); setFieldErrors({});
    const patch: Record<string, string | null> = {};
    for (const key of fieldNames) {
      if (draft[key] !== baseline[key]) {
        patch[key] = (key === "email" || key === "phone") && !draft[key].trim() ? null : draft[key];
      }
    }
    try {
      const response = await fetch(url, {
        method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": saved.etag },
        body: JSON.stringify(patch),
      });
      const body = await response.json();
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) forgetContact();
        if (response.status === 412 || response.status >= 500) { setBlocked(true); setLatest(null); }
        setFieldErrors(body.fieldErrors ?? {});
        setError(body.error || "Could not save contact.");
        return;
      }
      const result = body as ContactDetailResult;
      setSaved({ contact: result.contact, etag: response.headers.get("etag") || contactETag(result.contact) });
      setDraft(draftFor(result.contact)); setLatest(null); setBlocked(false); setNotice("Contact updated.");
    } catch {
      setBlocked(true); setLatest(null);
      setError("The save could not be confirmed. Your draft is preserved. Load the latest details before trying again.");
    } finally { inFlight.current = false; setSaving(false); }
  }

  function reviewLatest(keepEdits: boolean) {
    if (!latest || !draft || !baseline) return;
    const next = draftFor(latest.contact);
    if (keepEdits) {
      for (const key of fieldNames) if (draft[key] !== baseline[key]) next[key] = draft[key];
    }
    setSaved(latest); setDraft(next); setLatest(null); setBlocked(false); setError(null); setFieldErrors({});
    setNotice(keepEdits ? "Review your edits against the latest details, then save." : "Latest details loaded.");
  }

  return <div className="mx-auto max-w-4xl space-y-6 px-5 py-10 lg:px-8">
    <Link href="/admin/crm" className="text-cyan-200 underline">Back to contacts</Link>
    <header>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Customer relationships</p>
      <h1 className="mt-2 text-3xl font-semibold">Contact details</h1>
    </header>
    {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4">{error}</p> : null}
    {notice ? <p role="status" className="text-emerald-300">{notice}</p> : null}
    {loading ? <p role="status">Loading contact details…</p> : null}
    {!draft || !saved ? !loading ? <button type="button" onClick={() => void load(false)} className="rounded-lg border border-white/20 px-4 py-2">Retry loading details</button> : null : <>
      <form onSubmit={save} aria-label="Edit contact" className="glass-panel space-y-5 rounded-2xl p-6">
        <fieldset disabled={saving || loading} className="grid gap-4 sm:grid-cols-2">
          {(["full_name", "email", "phone"] as const).map(key => <div key={key} className="space-y-2">
            <label htmlFor={`contact-${key}`}>{labels[key]}</label>
            <input id={`contact-${key}`} name={key} value={draft[key]} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
              required={key === "full_name"} maxLength={key === "full_name" ? 160 : key === "email" ? 254 : 16}
              pattern={key === "phone" ? "\\+[1-9][0-9]{6,14}" : undefined}
              autoComplete={key === "full_name" ? "name" : key === "phone" ? "tel" : "email"}
              aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `${key}-error` : key === "phone" ? "phone-help" : undefined}
              onChange={event => setDraft({ ...draft, [key]: event.target.value })} className={inputStyle} />
            {fieldErrors[key] ? <span id={`${key}-error`} className="text-sm text-red-200">{fieldErrors[key]}</span> : null}
          </div>)}
          <div className="space-y-2"><label htmlFor="contact-source">Source</label>
            <select id="contact-source" name="source" value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })}
              aria-invalid={Boolean(fieldErrors.source)} aria-describedby={fieldErrors.source ? "source-error" : undefined}
              className={inputStyle}>
              <option value="manual">Manual entry</option><option value="referral">Referral</option>
              <option value="website">Website</option><option value="import">Import</option>
            </select>
            {fieldErrors.source ? <span id="source-error" className="text-sm text-red-200">{fieldErrors.source}</span> : null}
          </div>
        </fieldset>
        <p id="phone-help" className="text-sm text-slate-400">Keep an email address or phone number. Phone numbers include the country code, without spaces.</p>
        <div className="flex flex-wrap gap-3">
          <button disabled={saving || loading || blocked || !dirty} className="rounded-xl bg-cyan-200 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
          <button type="button" disabled={saving || loading || !dirty} onClick={() => {
            setDraft(draftFor(saved.contact)); setFieldErrors({}); setNotice(null);
          }} className="rounded-xl border border-white/20 px-5 py-3 disabled:opacity-50">Cancel changes</button>
        </div>
      </form>
      {blocked ? <section aria-label="Review latest contact" className="glass-panel space-y-4 rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Review before saving again</h2>
        <p>Your draft stays in the form. Load the latest details to check what changed.</p>
        <button type="button" disabled={loading || saving} onClick={() => void load(true)} className="rounded-lg border border-white/20 px-4 py-2">Load latest details</button>
        {latest ? <>
          <dl className="grid gap-3 sm:grid-cols-2">{fieldNames.map(key => <div key={key}>
            <dt className="text-sm text-slate-400">Latest {labels[key].toLowerCase()}</dt>
            <dd className="break-words">{latest.contact[key as keyof ContactPatch] || "None"}</dd>
          </div>)}</dl>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={loading || saving} onClick={() => reviewLatest(true)} className="rounded-lg border border-cyan-200/50 px-4 py-2">Keep my edits for review</button>
            <button type="button" disabled={loading || saving} onClick={() => reviewLatest(false)} className="rounded-lg border border-white/20 px-4 py-2">Use latest details</button>
          </div>
        </> : null}
      </section> : null}
    </>}
  </div>;
}
