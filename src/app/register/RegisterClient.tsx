"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterClient() {
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!invitationCode.trim()) {
      setError("Invitation code is required.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitationCode: invitationCode.trim().toUpperCase(),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      return;
    }

    await signIn("google", { callbackUrl: "/" });
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#ff7fa4] focus:ring-4 focus:ring-[#ffb1c4]/25";
  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fbfa] px-4 py-8 text-slate-950">
      {/* Background gradient hazes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,177,196,0.36),transparent_62%)] blur-[80px]" />
        <div className="absolute -right-24 top-16 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(99,247,255,0.24),transparent_58%)] blur-[70px]" />
        <div className="absolute bottom-0 left-1/2 h-[350px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,228,237,0.9),transparent_55%)] blur-[60px]" />
      </div>

      <div className="card-fade-in relative z-10 w-full max-w-md rounded-[28px] border border-white/80 bg-white/78 px-8 py-10 shadow-[0_28px_80px_rgba(79,102,124,0.18),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/dark_wide.png"
            alt="Lyfe Fitness"
            className="h-auto w-44"
          />
          <h1 className="font-[family-name:var(--font-brand-heading)] text-2xl font-bold text-slate-950">
            Create your account
          </h1>
          <p className="text-center text-sm font-medium text-slate-600">
            Enter your invitation code, then continue with Google.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invitationCode" className={labelClass}>
              Invitation Code
            </label>
            <input
              id="invitationCode"
              type="text"
              required
              autoComplete="off"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
              className={`${inputClass} font-mono tracking-[0.25em]`}
              placeholder="ABCD1234"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#ffb1c4] px-4 py-3 text-sm font-bold text-[#17141f] shadow-[0_16px_34px_rgba(255,126,164,0.28)] transition hover:bg-[#ffc4d3] disabled:opacity-50"
          >
            {!loading ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            ) : null}
            {loading ? "Checking invitation..." : "Continue with Google"}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-8 text-center text-sm font-medium text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#d94679] transition hover:text-[#b9285f]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
