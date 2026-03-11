import Link from "next/link";
import SidebarShell from "../../components/SidebarShell";

export default function ManagementPage() {
  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Management</h1>
          <p className="mt-3 text-sm text-slate-400">
            Organize delivery lanes, owners, and execution checkpoints.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/management/kanban"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Kanban</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Flow board</h3>
            <p className="mt-2 text-sm text-slate-400">
              Visualize projects and tasks across your pipeline.
            </p>
          </Link>
          <Link
            href="/management/projects"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Projects</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Delivery overview</h3>
            <p className="mt-2 text-sm text-slate-400">
              Track initiatives, owners, and timelines in one place.
            </p>
          </Link>
          <Link
            href="/management/tasks"
            className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tasks</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">Execution queue</h3>
            <p className="mt-2 text-sm text-slate-400">
              Break projects into trackable, actionable work.
            </p>
          </Link>
        </section>
      </section>
    </SidebarShell>
  );
}
