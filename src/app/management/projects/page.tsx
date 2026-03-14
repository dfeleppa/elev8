import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createProject(formData: FormData) {
  "use server";

  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return;
  }

  await supabaseAdmin
    .from("projects")
    .insert({ name, status: "planned", member_id: userId });

  revalidatePath("/management/projects");
}

type Project = {
  id: string;
  name: string;
  owner: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TaskRow = {
  id: string;
  status: string | null;
  due_date: string | null;
  is_complete: boolean | null;
  updated_at: string | null;
};

type ProjectRow = Project & {
  tasks: TaskRow[] | null;
};

async function getProjects(memberId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, owner, status, created_at, updated_at, tasks(id, status, due_date, is_complete, updated_at)")
    .eq("member_id", memberId)
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data ?? [];
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLatestActivity(project: ProjectRow) {
  const projectUpdatedAt = project.updated_at ? new Date(project.updated_at).getTime() : 0;
  const latestTaskUpdatedAt = (project.tasks ?? []).reduce((latest, task) => {
    if (!task.updated_at) {
      return latest;
    }

    const taskTime = new Date(task.updated_at).getTime();
    return taskTime > latest ? taskTime : latest;
  }, 0);

  const latest = Math.max(projectUpdatedAt, latestTaskUpdatedAt);
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function getTaskMetrics(tasks: TaskRow[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completed = tasks.filter((task) => task.is_complete).length;
  const active = tasks.filter((task) => !task.is_complete).length;
  const overdue = tasks.filter((task) => {
    if (task.is_complete || !task.due_date) {
      return false;
    }

    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;

  return {
    total: tasks.length,
    completed,
    active,
    overdue,
  };
}

function getStatusStyles(status: string | null) {
  const normalized = status?.toLowerCase() ?? "";

  if (normalized === "doing") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "ongoing") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "planned") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (normalized === "on hold") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (normalized === "done" || normalized === "complete") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (normalized === "open") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-white text-slate-600";
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default async function ManagementProjectsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const projects = await getProjects(userId);

  return (
    <SidebarShell mainClassName="w-full px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Projects</h1>
          <p className="mt-3 text-sm text-slate-400">
            Manage delivery lanes, owners, and execution timing.
          </p>
        </header>

        <section className="glass-panel rounded-[28px] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Portfolio</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Active projects</h2>
            </div>
            <span className="text-xs text-slate-400">{projects.length} total</span>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-[13px] text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Meta</th>
                    <th className="px-4 py-2.5">Progress</th>
                    <th className="px-4 py-2.5" aria-label="Select" />
                    <th className="px-4 py-2.5">Latest Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-5 text-sm text-slate-500"
                      >
                        No projects yet. Add one in Supabase to start tracking.
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => {
                      const tasks = project.tasks ?? [];
                      const metrics = getTaskMetrics(tasks);
                      const progress = metrics.total > 0
                        ? (metrics.completed / metrics.total) * 100
                        : 0;
                      const progressLabel = metrics.total > 0 ? progress.toFixed(1) : "0.0";
                      const latestActivity = getLatestActivity(project);

                      return (
                        <tr key={project.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-2.5 align-middle">
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-600">
                                {getInitials(project.name)}
                              </span>
                              <div>
                                <p className="text-[13px] font-semibold text-slate-900">{project.name}</p>
                                {project.owner ? (
                                  <p className="mt-0.5 text-[11px] text-slate-500">Owner: {project.owner}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusStyles(project.status)}`}
                            >
                              {project.status ?? "Unscheduled"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-[13px]">
                            <div className="flex flex-col gap-1">
                              <span className="text-sky-700">{metrics.active} Active</span>
                              <span className={metrics.overdue > 0 ? "text-rose-600" : "text-slate-500"}>
                                {metrics.overdue} Overdue
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle">
                            <div className="flex items-center gap-3">
                              <span className="w-14 text-[11px] text-slate-600">{progressLabel}%</span>
                              <div className="h-2 w-28 rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-400"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle">
                            <input
                              type="checkbox"
                              aria-label={`Select ${project.name}`}
                              className="h-4 w-4 rounded border border-slate-300 bg-white text-sky-500"
                              disabled
                            />
                          </td>
                          <td className="px-4 py-2.5 align-middle text-[13px] text-slate-600">
                            {formatDateTime(latestActivity)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-sm text-slate-500">
                      <form action={createProject} className="flex flex-wrap items-center gap-3">
                        <span className="text-lg text-slate-400">+</span>
                        <input
                          type="text"
                          name="name"
                          placeholder="New project name"
                          className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 placeholder:text-slate-400"
                          required
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                        >
                          Create
                        </button>
                        <span className="text-[11px] text-slate-400">Defaults to planned</span>
                      </form>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </section>
    </SidebarShell>
  );
}
