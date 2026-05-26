"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterClient() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!invitationCode.trim()) {
      setError("Invitation code is required.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        invitationCode: invitationCode.trim().toUpperCase(),
        password,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      return;
    }

    router.push("/login?registered=true");
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
          <p className="text-sm font-medium text-slate-600">Join Lyfe Fitness to get started</p>
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
            <label htmlFor="fullName" className={labelClass}>
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="John Doe"
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
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
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Re-enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#ffb1c4] px-4 py-3 text-sm font-bold text-[#17141f] shadow-[0_16px_34px_rgba(255,126,164,0.28)] transition hover:bg-[#ffc4d3] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
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
