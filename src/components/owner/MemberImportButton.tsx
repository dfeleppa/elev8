"use client";

import { useRef, useState } from "react";

type ImportResult = {
  total: number;
  inserted: number;
  updated: number;
};

const uploadIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export default function MemberImportButton({ organizationId }: { organizationId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus("loading");
    setResult(null);
    setErrorMsg(null);

    const text = await file.text();
    const url = organizationId
      ? `/api/owner/members/import?organizationId=${encodeURIComponent(organizationId)}`
      : "/api/owner/members/import";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });

      const json = (await response.json()) as { ok?: boolean; error?: string; total?: number; inserted?: number; updated?: number };

      if (!response.ok || !json.ok) {
        setStatus("error");
        setErrorMsg(json.error ?? "Import failed.");
        return;
      }

      setStatus("success");
      setResult({ total: json.total ?? 0, inserted: json.inserted ?? 0, updated: json.updated ?? 0 });
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    // Reset so the same file can be re-imported if needed.
    event.target.value = "";
  }

  function dismiss() {
    setStatus("idle");
    setResult(null);
    setErrorMsg(null);
  }

  if (status === "success" && result) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-emerald-400">
          {result.inserted} added, {result.updated} updated ({result.total} total)
        </span>
        <button
          type="button"
          onClick={() => { dismiss(); window.location.reload(); }}
          className="text-xs text-white/60 underline hover:text-white/90"
        >
          Refresh
        </button>
        <button type="button" onClick={dismiss} className="text-xs text-white/40 hover:text-white/70">
          ✕
        </button>
      </div>
    );
  }

  if (status === "error" && errorMsg) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-rose-400">{errorMsg}</span>
        <button type="button" onClick={dismiss} className="text-xs text-white/40 hover:text-white/70">
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={handleChange}
        aria-label="Import members from CSV"
      />
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
      >
        {status === "loading" ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            Importing…
          </>
        ) : (
          <>
            {uploadIcon}
            Import CSV
          </>
        )}
      </button>
    </>
  );
}
