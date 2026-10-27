"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import OAuthButtons from "@/components/OAuthButtons";

export default function RegisterClient({ appleEnabled = false }: { appleEnabled?: boolean }) {
  const code = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  async function verifyInvitation() {
    setError(null);
    if (!code.current?.reportValidity()) return false;
    const response = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationCode: code.current.value.trim().toUpperCase() }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not verify your invitation."); return false; }
    return true;
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f7fbfa] px-4 text-slate-950">
    <section className="w-full max-w-md space-y-6 rounded-[28px] border border-slate-200 bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-sm text-slate-600">Enter your invitation code, then continue with {appleEnabled ? "Google or Apple" : "Google"}.</p>
      <div><label htmlFor="invitation-code" className="mb-2 block text-sm font-semibold">Invitation code</label>
        <input ref={code} id="invitation-code" type="text" required autoComplete="off" maxLength={128}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase tracking-widest" />
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      <OAuthButtons appleEnabled={appleEnabled} beforeSignIn={verifyInvitation} />
      <p className="text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="font-semibold text-[#b9285f]">Sign in</Link></p>
    </section>
  </main>;
}
