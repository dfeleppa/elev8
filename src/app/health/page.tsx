import Link from "next/link";
import SidebarShell from "../../components/SidebarShell";

export default function HealthPage() {
  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Health</h1>
          <p className="mt-3 text-sm text-slate-400">
            Training programs, nutrition targets, and recovery signals.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          <Link
            href="/health/training"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Training</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Performance blocks</h3>
            <p className="mt-2 text-sm text-slate-400">Plans, sessions, and progress notes.</p>
          </Link>
          <Link
            href="/health/nutrition"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Nutrition</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Fuel strategy</h3>
            <p className="mt-2 text-sm text-slate-400">Macros, supplements, and meal plans.</p>
          </Link>
          <Link
            href="/health/feeds"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Feeds</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Recovery signals</h3>
            <p className="mt-2 text-sm text-slate-400">Sleep, readiness, and wearable data.</p>
          </Link>
        </section>
      </section>
    </SidebarShell>
  );
}
