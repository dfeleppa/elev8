"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OAuthButtons from "@/components/OAuthButtons";

export function sanitizeCallbackUrl(value: string | null) {
  if (!value) return "/";
  try {
    const origin = typeof window === "undefined" ? "https://app.invalid" : window.location.origin;
    const url = new URL(value, origin);
    if (url.origin === origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch { /* Invalid callback returns home. */ }
  return "/";
}

export default function LoginClient({ appleEnabled = false }: { appleEnabled?: boolean }) {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const error = authError === "identity_link_required" || authError === "crm_identity"
    ? "This account is not linked to your Lyfe Fitness account. Ask gym staff to help link it, or use your invitation code to create a new account."
    : authError ? "Sign-in could not be completed. Please try again or contact gym staff." : null;
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fbfa] px-4 text-slate-950">
    <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-pink-200/40 blur-[80px]" />
    <div className="pointer-events-none absolute -right-24 top-16 h-[400px] w-[400px] rounded-full bg-cyan-200/30 blur-[70px]" />
    <section className="relative z-10 w-full max-w-md space-y-6 rounded-[28px] border border-white/80 bg-white/80 px-8 py-10 shadow-xl backdrop-blur-2xl">
      <div className="flex flex-col items-center gap-3">
        <img src="/dark_wide.png" alt="Lyfe Fitness" className="h-auto w-44" />
        <h1 className="font-[family-name:var(--font-brand-heading)] text-2xl font-bold">Welcome back</h1>
        <p className="text-center text-sm text-slate-600">Sign in with {appleEnabled ? "Google or Apple" : "Google"}.</p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
      <OAuthButtons appleEnabled={appleEnabled} callbackUrl={sanitizeCallbackUrl(searchParams.get("callbackUrl"))} />
      <p className="text-center text-sm text-slate-600">New to Lyfe Fitness? <Link href="/register" className="font-semibold text-[#b9285f]">Use an invitation code</Link></p>
    </section>
  </main>;
}
