"use client";

import { useState } from "react";

import SidebarShell from "../../components/SidebarShell";

export default function YouTubeScriptsPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("Script saved (API integration coming soon).");
    setTitle("");
    setContent("");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-4xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Content</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">YouTube Scripts</h1>
          <p className="mt-3 text-sm text-slate-400">Upload and collaborate on scripts here.</p>
        </header>

        <div className="glass-panel rounded-[28px] border border-white/10 p-6 md:p-8">
          {notice ? (
            <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              {notice}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="script-title" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Title
              </label>
              <input
                id="script-title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Script title"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#ffb1c4]/60 focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="script-content" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Script
              </label>
              <textarea
                id="script-content"
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Paste script here..."
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#ffb1c4]/60 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-white shadow-[0_4px_20px_rgba(255,177,196,0.2)] transition hover:brightness-110 active:scale-95"
              >
                Save Script
              </button>
            </div>
          </form>
        </div>
      </section>
    </SidebarShell>
  );
}
