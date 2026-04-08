"use client";

import Image from "next/image";
import { useState } from "react";
import { signOut } from "next-auth/react";

export default function JoinClient() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/join-organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationCode: code.trim() }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to join organization.");
      return;
    }

    setSuccess(`Joined ${data.organizationName}! Redirecting...`);

    // Force a session refresh so the JWT picks up the new org membership
    // We do this by signing in again — but the simplest way is to redirect
    // and let the middleware pass through on next load.
    setTimeout(() => {
      // Use window.location for a full reload so middleware re-evaluates
      window.location.href = "/";
    }, 1500);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background gradient hazes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,177,196,0.18),transparent_62%)] blur-[80px]" />
        <div className="absolute -right-24 top-16 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(99,247,255,0.12),transparent_58%)] blur-[70px]" />
        <div className="absolute bottom-0 left-1/2 h-[350px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,74,141,0.1),transparent_55%)] blur-[60px]" />
      </div>

      <div className="card-fade-in glass-panel relative z-10 w-full max-w-md rounded-2xl px-8 py-10">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Image
              src="/Elev8rlogo (1).png"
              alt="Elev8"
              width={40}
              height={40}
              className="object-contain"
            />
          </span>
          <h1 className="font-[family-name:var(--font-brand-heading)] text-2xl font-bold text-slate-100">
            Join Your Organization
          </h1>
          <p className="text-center text-sm text-slate-400">
            Enter the invitation code provided by your organization to get started.
          </p>
        </div>

        {/* Success banner */}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-center text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Join form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="invitationCode"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50"
              >
                Invitation Code
              </label>
              <input
                id="invitationCode"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-center text-lg font-semibold tracking-widest text-slate-100 placeholder:text-white/25 focus:border-[#ffb1c4]/60 focus:outline-none"
                placeholder="ABCD1234"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full rounded-xl bg-[#ffb1c4] px-4 py-3 text-sm font-semibold text-[#0c1118] transition hover:bg-[#ffc4d3] disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Organization"}
            </button>
          </form>
        )}

        {/* Sign out link */}
        <p className="mt-8 text-center text-sm text-slate-400">
          Wrong account?{" "}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="font-medium text-[#ffb1c4] transition hover:text-[#ffc4d3]"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
