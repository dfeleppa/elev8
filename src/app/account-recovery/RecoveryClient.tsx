"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRecoveryProof, type RecoveryProof } from "@/lib/account-recovery";

export default function RecoveryClient() {
  const proof = useRef<RecoveryProof | null | undefined>(undefined);
  const client = useRef<SupabaseClient | null>(null);
  const inFlight = useRef(false);
  const [stage, setStage] = useState<"verify" | "password" | "done" | "invalid">("verify");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Keep proof only in this mounted page. Do not consume links during a GET
    // or persist Auth tokens in browser storage / the NextAuth session.
    if (proof.current === undefined) {
      proof.current = parseRecoveryProof(window.location.hash);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function verifyLink() {
    if (inFlight.current) return;
    if (!proof.current) { setStage("invalid"); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const result = await auth.auth.verifyOtp(proof.current);
      proof.current = null;
      if (result.error || !result.data.session || !result.data.user?.email) {
        setStage("invalid");
        return;
      }
      client.current = auth;
      setEmail(result.data.user.email);
      setStage("password");
    } catch {
      setError("Could not verify the link. Check your connection and try again, or ask gym staff for a new link.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !client.current) return;
    if (password.length < 12) { setError("Use at least 12 characters."); return; }
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await client.current.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.code === "weak_password" || updateError.code === "same_password"
          ? "Choose a different, stronger password with at least 12 characters."
          : "The password could not be saved. Try again or ask gym staff for a new link.");
        return;
      }
      // Best-effort revoke this recovery session; discard it even on network
      // failure. Protected app access still requires a fresh password login.
      await client.current.auth.signOut({ scope: "local" }).catch(() => undefined);
      client.current = null;
      setPassword("");
      setConfirmation("");
      setStage("done");
    } catch {
      setError("The save could not be confirmed. Try signing in with your new password, or ask gym staff for a new link.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200";
  const buttonClass = "w-full rounded-xl bg-[#ffb1c4] px-4 py-3 font-bold text-[#17141f] hover:bg-[#ffc4d3] disabled:opacity-50";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fbfa] px-4 text-slate-950">
      <section className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl" aria-labelledby="recovery-title">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Lyfe Fitness</p>
        <h1 id="recovery-title" className="text-2xl font-bold">Set your password</h1>
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        {stage === "verify" ? <>
          <p className="text-sm text-slate-600">Continue to verify your invitation or password setup link.</p>
          <button type="button" disabled={busy} onClick={verifyLink} className={buttonClass}>{busy ? "Verifying..." : "Verify link"}</button>
          <p className="text-sm text-slate-600">Need a link? Ask gym staff to review your account access.</p>
        </> : null}
        {stage === "invalid" ? <p role="alert" className="text-sm text-rose-700">This link is missing, expired, or already used. Ask gym staff for a new password setup link.</p> : null}
        {stage === "password" ? <form onSubmit={savePassword} className="space-y-4">
          <p className="text-sm text-slate-600">Choose a password for <strong>{email}</strong>. Use at least 12 characters.</p>
          <div><label htmlFor="new-password" className="mb-2 block text-sm font-semibold">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} /></div>
          <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold">Confirm password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} /></div>
          <button type="submit" disabled={busy} className={buttonClass}>{busy ? "Saving..." : "Save password"}</button>
        </form> : null}
        {stage === "done" ? <p role="status" className="text-sm text-emerald-800">Password saved. Sign in with your email and new password. If access is still unavailable, ask gym staff to finish linking your account.</p> : null}
        <Link href="/login" className="block text-center text-sm font-semibold text-[#b9285f]">Back to sign in</Link>
      </section>
    </main>
  );
}
