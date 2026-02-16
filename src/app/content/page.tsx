import Link from "next/link";
import SidebarShell from "../../components/SidebarShell";
import { getLatestYoutubeMetrics } from "../../lib/youtube-metrics";

export const dynamic = "force-dynamic";

function formatCompact(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export default async function ContentPage() {
  const youtubeMetrics = await getLatestYoutubeMetrics();
  const metricsLabel = youtubeMetrics.periodStart && youtubeMetrics.periodEnd
    ? `${youtubeMetrics.periodStart} to ${youtubeMetrics.periodEnd}`
    : "Last 30 days";

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Content</h1>
          <p className="mt-3 text-sm text-slate-400">Channel overview and publishing systems.</p>
        </header>

        <section className="glass-panel rounded-[28px] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Metrics</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Channel performance</h2>
            </div>
            <span className="text-xs text-slate-400">{metricsLabel}</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">X followers</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">—</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">X post views</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">—</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">YouTube subscribers gained</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {formatCompact(youtubeMetrics.subscribersGained)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">YouTube views</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                {formatCompact(youtubeMetrics.views)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">Meta metrics coming soon.</p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <Link
            href="/content/youtube"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">YouTube</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Video pipeline</h3>
            <p className="mt-2 text-sm text-slate-400">Planning, production, and publishing.</p>
          </Link>
          <Link
            href="/content/x"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">X</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Daily distribution</h3>
            <p className="mt-2 text-sm text-slate-400">Threads, clips, and reach plans.</p>
          </Link>
          <Link
            href="/content/meta"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Meta</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Platform readiness</h3>
            <p className="mt-2 text-sm text-slate-400">Reels, pages, and audience tests.</p>
          </Link>
        </section>
      </section>
    </SidebarShell>
  );
}
