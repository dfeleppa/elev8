"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function sanitizeCallbackUrl(value: string | null) {
  if (!value) {
    return "/";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  if (typeof window !== "undefined") {
    try {
      const url = new URL(value);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return "/";
    }
  }

  return "/";
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const externalError =
    authError === "identity_link_required"
      ? "Sign in with your linked email and password account. Contact gym staff if you need help accessing your account."
      : authError === "crm_identity"
      ? "Contacts requires a linked Elev8 account signed in with email and password. Ask an administrator if your account needs to be linked."
      : authError === "reserved_email"
      ? "This email already exists in an organization's member roster and cannot be used to create an app account."
      : authError === "invite_required"
        ? "Create an account with your invitation code before signing in with Google."
      : null;

  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600";
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#ff7fa4] focus:ring-4 focus:ring-[#ffb1c4]/25";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fbfa] px-4 text-slate-950">
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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Lyfe Fitness</p>
          <h1 className="font-[family-name:var(--font-brand-heading)] text-2xl font-bold text-slate-950">
            Welcome back
          </h1>
          <p className="text-center text-sm font-medium text-slate-600">Sign in to your Lyfe Fitness account</p>
        </div>

        {/* Success banner */}
        {registered && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
            Account created successfully. Sign in to continue.
          </div>
        )}

        {/* Error banner */}
        {(error || externalError) && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-800">
            {error ?? externalError}
          </div>
        )}

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#ffb1c4] px-4 py-3 text-sm font-bold text-[#17141f] shadow-[0_16px_34px_rgba(255,126,164,0.28)] transition hover:bg-[#ffc4d3] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-600">
          Google sign-in and self-registration are currently unavailable. Need access or a new password? Ask gym staff for a password setup link.
        </p>
      </div>
    </div>
  );
}
