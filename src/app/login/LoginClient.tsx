"use client";

import Link from "next/link";
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
    authError === "reserved_email"
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

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            or continue with
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white"
          >
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
            Continue with Google
          </button>

        </div>

        {/* Register link */}
        <p className="mt-8 text-center text-sm font-medium text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-bold text-[#d94679] transition hover:text-[#b9285f]">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
