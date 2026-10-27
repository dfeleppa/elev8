"use client";

import { useState } from "react";
import { getProviders, signIn } from "next-auth/react";

export default function OAuthButtons({ callbackUrl = "/", beforeSignIn, appleEnabled = false }: {
  appleEnabled?: boolean;
  callbackUrl?: string;
  beforeSignIn?: () => Promise<boolean>;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(provider: "google" | "apple") {
    if (loading) return;
    setLoading(provider);
    setError(null);
    try {
      const providers = await getProviders();
      if (!providers?.[provider]) {
        setError(`${provider === "google" ? "Google" : "Apple"} sign-in is not configured yet. Please contact gym staff.`);
        return;
      }
      if (beforeSignIn && !(await beforeSignIn())) return;
      const result = await signIn(provider, { callbackUrl });
      if (result?.error) setError("Sign-in could not be completed. Please try again.");
    } catch {
      setError("Could not start sign-in. Please try again.");
    } finally { setLoading(null); }
  }
  return <div className="space-y-3">
    {(appleEnabled ? ["google", "apple"] as const : ["google"] as const).map(provider => <button key={provider} type="button"
      onClick={() => void start(provider)} disabled={loading !== null}
      className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${provider === "apple" ? "border-black bg-black text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-950 hover:bg-slate-50"}`}>
      {provider === "google" ? <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg> : <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M17.05 12.54c.02 3.01 2.64 4.01 2.67 4.02-.02.07-.42 1.43-1.38 2.84-.83 1.22-1.7 2.43-3.06 2.46-1.34.03-1.77-.8-3.3-.8-1.54 0-2.02.77-3.29.83-1.31.05-2.31-1.32-3.15-2.53-1.72-2.49-3.03-7.03-1.27-10.1a4.9 4.9 0 0 1 4.15-2.51c1.3-.03 2.52.88 3.3.88.79 0 2.27-1.09 3.83-.93.66.03 2.5.27 3.68 2-.1.06-2.2 1.28-2.18 3.84zM14.53 5.05c.7-.85 1.17-2.03 1.04-3.2-1.01.04-2.23.67-2.95 1.52-.65.75-1.22 1.95-1.07 3.1 1.13.09 2.28-.58 2.98-1.42z"/></svg>}
      {loading === provider ? "Connecting..." : `Continue with ${provider === "google" ? "Google" : "Apple"}`}
    </button>)}
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
  </div>;
}
