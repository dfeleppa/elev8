"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Contact, ContactPage } from "./contracts";

export default function ContactsWorkspace() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);
  const savingRef = useRef(false);
  const loadSequence = useRef(0);

  const load = useCallback(async (after?: string, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/v1/crm/contacts${after ? `?cursor=${after}` : ""}`, { signal, cache: "no-store" });
      const body = await response.json();
      if (sequence !== loadSequence.current || signal?.aborted) return;
      if (!response.ok) throw new Error(body.error || "Could not load contacts.");
      const page = body as ContactPage;
      setContacts(previous => after ? [...previous, ...page.contacts.filter(c => !previous.some(p => p.id === c.id))] : page.contacts);
      setCursor(page.nextCursor);
    } catch (e) {
      if (!signal?.aborted && sequence === loadSequence.current) {
        setContacts([]); setCursor(null);
        setError(e instanceof Error ? e.message : "Could not load contacts.");
      }
    } finally { if (!signal?.aborted && sequence === loadSequence.current) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null); setNotice(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    pendingId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/crm/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        id: pendingId.current, full_name: values.get("full_name"), email: values.get("email"), phone: values.get("phone"), source: values.get("source"),
      }) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) { pendingId.current = null; form.reset(); await load(); }
        throw new Error(body.error || "Could not save contact.");
      }
      pendingId.current = null; form.reset();
      await load(); setNotice("Contact saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save contact."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 lg:px-8">
    <header><p className="text-xs uppercase tracking-[0.3em] text-slate-400">Customer relationships</p>
      <h1 className="mt-2 text-3xl font-semibold">Contacts</h1>
      <p className="mt-3 text-slate-400">Keep prospects and customer details together. Adding a contact does not create a member login.</p>
    </header>
    {error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4">{error} <button type="button" className="underline" disabled={loading} onClick={() => void load()}>Refresh contacts</button></div> : null}
    {notice ? <p role="status" className="text-emerald-300">{notice}</p> : null}
    <form onSubmit={create} className="glass-panel space-y-4 rounded-2xl p-6">
      <h2 className="text-lg font-semibold">Add a contact</h2>
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">Name<input name="full_name" required maxLength={160} autoComplete="name" className="block w-full rounded-lg border border-white/15 bg-black/20 p-3" /></label>
        <label className="space-y-2">Email<input name="email" type="email" maxLength={254} autoComplete="email" className="block w-full rounded-lg border border-white/15 bg-black/20 p-3" /></label>
        <label className="space-y-2">Phone<input name="phone" type="tel" placeholder="+15551234567" pattern="\+[1-9][0-9]{6,14}" autoComplete="tel" aria-describedby="phone-help" className="block w-full rounded-lg border border-white/15 bg-black/20 p-3" /><span id="phone-help" className="text-xs text-slate-400">Include the country code, without spaces.</span></label>
        <label className="space-y-2">Source<select name="source" className="block w-full rounded-lg border border-white/15 bg-slate-900 p-3"><option value="manual">Manual entry</option><option value="referral">Referral</option><option value="website">Website</option><option value="import">Import</option></select></label>
      </fieldset>
      <p className="text-sm text-slate-400">Provide an email address or phone number.</p>
      <button disabled={saving} className="rounded-xl bg-cyan-200 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{saving ? "Saving…" : "Save contact"}</button>
    </form>
    <section aria-label="Contact directory" aria-busy={loading} className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 p-5"><h2 className="font-semibold">Directory</h2><span className="text-sm text-slate-400">{contacts.length} loaded</span></div>
      {contacts.length === 0 ? <p className="p-8 text-slate-400">{loading ? "Loading contacts…" : error ? "The directory could not be loaded." : "Your first relationship starts here. Add a contact above."}</p> :
        <ul className="divide-y divide-white/10">{contacts.map(contact => <li key={contact.id} className="grid gap-2 p-5 sm:grid-cols-3"><Link href={`/admin/crm/contacts/${contact.id}`} className="font-semibold text-cyan-200 underline">{contact.full_name}</Link><div className="min-w-0 break-words text-sm text-slate-300"><p>{contact.email}</p><p>{contact.phone}</p></div><span className="text-sm capitalize text-slate-400">{contact.source}</span></li>)}</ul>}
      {cursor ? <button type="button" disabled={loading} onClick={() => void load(cursor)} className="m-5 rounded-lg border border-white/20 px-4 py-2">{loading ? "Loading…" : "Load more"}</button> : null}
    </section>
  </div>;
}
