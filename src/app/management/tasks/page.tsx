import Link from "next/link";
import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createTask(formData: FormData) {
  "use server";

  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    return;
  }

  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!title) {
    return;
  }

  await supabaseAdmin
    .from("tasks")
    .insert({
      title,
      status: "planned",
      project_id: projectId || null,
      member_id: userId,
    });

  revalidatePath("/management/tasks");
}

type Task = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  is_complete: boolean | null;
  notes: string | null;
  project: { id: string; name: string } | null;
};

type TaskRow = Omit<Task, "project"> & {
  project: { id: string; name: string }[] | null;
};

async function getTasks(memberId: string): Promise<Task[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, title, status, due_date, priority, is_complete, notes, project:projects(id, name)")
    .eq("member_id", memberId)
    .order("due_date", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map((task) => {
    const row = task as TaskRow;

    return {
      ...row,
      project: row.project?.[0] ?? null,
    };
  });
}

async function getProjects(memberId: string) {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, name")
    .eq("member_id", memberId)
    .order("name", { ascending: true });

  return data ?? [];
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusStyles(status: string | null, isComplete: boolean | null) {
  if (isComplete) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  const normalized = status?.toLowerCase() ?? "";

  if (normalized === "doing" || normalized === "in progress") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "ongoing") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
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

export default async function ManagementTasksPage({
  searchParams,
}: {
  searchParams?: { sort?: string; dir?: string; project?: string };
}) {
  type SortKey = "name" | "status" | "project" | "due" | "priority";
  type SortDir = "asc" | "desc";

  const getSortParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const sortKey = (getSortParam(searchParams?.sort) as SortKey) ?? "due";
  const sortDir = (getSortParam(searchParams?.dir) as SortDir) ?? "asc";
  const projectFilter = getSortParam(searchParams?.project) ?? "";
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const [tasks, projects] = await Promise.all([getTasks(userId), getProjects(userId)]);
  const dirFactor = sortDir === "asc" ? 1 : -1;

  const toDateValue = (value: string | null) => {
    if (!value) {
      return sortDir === "asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
    }

    return new Date(value).getTime();
  };

  const compareText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

  const filteredTasks = projectFilter
    ? tasks.filter((task) => task.project?.id === projectFilter)
    : tasks;

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return compareText(a.title, b.title) * dirFactor;
      case "status":
        return compareText(a.status ?? "", b.status ?? "") * dirFactor;
      case "project":
        return compareText(a.project?.name ?? "", b.project?.name ?? "") * dirFactor;
      case "priority":
        return compareText(a.priority ?? "", b.priority ?? "") * dirFactor;
      case "due":
      default:
        return (toDateValue(a.due_date) - toDateValue(b.due_date)) * dirFactor;
    }
  });

  const getSortHref = (key: SortKey) => {
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    const projectQuery = projectFilter ? `&project=${projectFilter}` : "";
    return `/management/tasks?sort=${key}&dir=${nextDir}${projectQuery}`;
  };

  const sortLabel = (key: SortKey) => {
    if (sortKey !== key) {
      return "";
    }

    return sortDir === "asc" ? " (asc)" : " (desc)";
  };

  return (
    <SidebarShell mainClassName="w-full px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Tasks</h1>
          <p className="mt-3 text-sm text-slate-400">Break projects into trackable work blocks.</p>
        </header>

        <section className="glass-panel app-card rounded-[28px] border border-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Queue</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Execution backlog</h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <form action="/management/tasks" method="get" className="flex items-center gap-2">
                <input type="hidden" name="sort" value={sortKey} />
                <input type="hidden" name="dir" value={sortDir} />
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Project
                </label>
                <select
                  name="project"
                  defaultValue={projectFilter}
                  className="h-9 rounded-lg border border-white/10 bg-white px-3 text-[12px] text-slate-700"
                >
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:text-slate-900"
                >
                  Apply
                </button>
              </form>
              <span className="text-xs text-slate-400">{filteredTasks.length} total</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="app-table-shell overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="app-table w-full min-w-[760px] text-[13px] text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    <th className="px-4 py-2.5">
                      <Link href={getSortHref("name")} className="hover:text-slate-900">
                        Name{sortLabel("name")}
                      </Link>
                    </th>
                    <th className="px-4 py-2.5">
                      <Link href={getSortHref("status")} className="hover:text-slate-900">
                        Status{sortLabel("status")}
                      </Link>
                    </th>
                    <th className="px-4 py-2.5">
                      <Link href={getSortHref("project")} className="hover:text-slate-900">
                        Project{sortLabel("project")}
                      </Link>
                    </th>
                    <th className="px-4 py-2.5">
                      <Link href={getSortHref("due")} className="hover:text-slate-900">
                        Due{sortLabel("due")}
                      </Link>
                    </th>
                    <th className="px-4 py-2.5">
                      <Link href={getSortHref("priority")} className="hover:text-slate-900">
                        Priority{sortLabel("priority")}
                      </Link>
                    </th>
                    <th className="px-4 py-2.5" aria-label="Select" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-5 text-sm text-slate-500"
                      >
                        No tasks yet. Add tasks to a project in Supabase.
                      </td>
                    </tr>
                  ) : (
                    sortedTasks.map((task) => (
                      <tr key={task.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-600">
                              {getInitials(task.title)}
                            </span>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-900">{task.title}</p>
                              {task.notes ? (
                                <p className="mt-0.5 text-[11px] text-slate-500">{task.notes}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusStyles(task.status, task.is_complete)}`}
                          >
                            {task.status ?? (task.is_complete ? "Done" : "In progress")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">
                          {task.project?.name ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">
                          {formatDate(task.due_date)}
                        </td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">
                          {task.priority ?? "TBD"}
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <input
                            type="checkbox"
                            aria-label={`Select ${task.title}`}
                            className="h-4 w-4 rounded border border-slate-300 bg-white text-sky-500"
                            disabled
                          />
                        </td>
                      </tr>
                    ))
                  )}
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-sm text-slate-500">
                      <form action={createTask} className="flex flex-wrap items-center gap-3">
                        <span className="text-lg text-slate-400">+</span>
                        <input
                          type="text"
                          name="title"
                          placeholder="New task title"
                          className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 placeholder:text-slate-400"
                          required
                        />
                        <select
                          name="projectId"
                          defaultValue={projectFilter}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700"
                        >
                          <option value="">No project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
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
