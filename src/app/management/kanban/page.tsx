import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  is_complete: boolean | null;
  project: { id: string; name: string } | null;
};

type TaskRow = Omit<Task, "project"> & {
  project: { id: string; name: string }[] | null;
};

type Project = {
  id: string;
  name: string;
  owner: string | null;
  status: string | null;
  updated_at: string | null;
};

type KanbanColumnKey = "planned" | "in-progress" | "blocked" | "done";

type KanbanItem = {
  id: string;
  type: "Task" | "Project";
  title: string;
  status: string | null;
  isComplete?: boolean | null;
  column: KanbanColumnKey;
  meta: string;
  secondary: string | null;
};

const columns: { key: KanbanColumnKey; label: string; hint: string }[] = [
  { key: "planned", label: "Planned", hint: "Queued" },
  { key: "in-progress", label: "In Progress", hint: "Active" },
  { key: "blocked", label: "Blocked", hint: "Needs help" },
  { key: "done", label: "Done", hint: "Shipped" },
];

async function getTasks(memberId: string): Promise<Task[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, title, status, due_date, priority, is_complete, project:projects(id, name)")
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

async function getProjects(memberId: string): Promise<Project[]> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, owner, status, updated_at")
    .eq("member_id", memberId)
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data ?? [];
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function normalizeStatus(status: string | null) {
  return status?.trim().toLowerCase() ?? "";
}

function getColumnKey(status: string | null, isComplete?: boolean | null): KanbanColumnKey {
  if (isComplete) {
    return "done";
  }

  const normalized = normalizeStatus(status);

  if (normalized === "done" || normalized === "complete") {
    return "done";
  }

  if (normalized === "blocked" || normalized === "on hold") {
    return "blocked";
  }

  if (normalized === "doing" || normalized === "in progress" || normalized === "ongoing") {
    return "in-progress";
  }

  return "planned";
}

function getStatusLabel(status: string | null, isComplete?: boolean | null) {
  if (isComplete) {
    return "Done";
  }

  const normalized = normalizeStatus(status);

  if (!normalized) {
    return "Planned";
  }

  if (normalized === "in progress") {
    return "In progress";
  }

  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

function getStatusStyles(status: string | null, isComplete?: boolean | null) {
  if (isComplete) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  const normalized = normalizeStatus(status);

  if (normalized === "doing" || normalized === "in progress" || normalized === "ongoing") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalized === "planned" || normalized === "open") {
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

export default async function ManagementKanbanPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const [tasks, projects] = await Promise.all([getTasks(userId), getProjects(userId)]);

  const items: KanbanItem[] = [
    ...tasks.map((task) => ({
      id: task.id,
      type: "Task" as const,
      title: task.title,
      status: task.status,
      isComplete: task.is_complete,
      column: getColumnKey(task.status, task.is_complete),
      meta: task.project?.name ?? "Unassigned",
      secondary: task.due_date ? `Due ${formatDate(task.due_date)}` : null,
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: "Project" as const,
      title: project.name,
      status: project.status,
      column: getColumnKey(project.status),
      meta: project.owner ? `Owner: ${project.owner}` : "No owner",
      secondary: project.updated_at ? `Updated ${formatDate(project.updated_at)}` : null,
    })),
  ];

  const itemsByColumn = columns.map((column) => ({
    ...column,
    items: items.filter((item) => item.column === column.key),
  }));

  return (
    <SidebarShell mainClassName="w-full px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Kanban</h1>
          <p className="mt-3 text-sm text-slate-400">
            Balance projects and tasks across the delivery pipeline.
          </p>
        </header>

        <section className="glass-panel min-h-[70vh] rounded-[28px] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Flow</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Work in progress</h2>
            </div>
            <span className="text-xs text-slate-400">{items.length} total</span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="flex min-h-[55vh] gap-4 items-stretch">
              {itemsByColumn.map((column) => (
                <div
                  key={column.key}
                  className="flex h-full w-72 flex-shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                        {column.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{column.hint}</p>
                    </div>
                    <span className="text-xs text-slate-400">{column.items.length}</span>
                  </div>

                  <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
                    {column.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-400">
                        Nothing here yet.
                      </div>
                    ) : (
                      column.items.map((item) => (
                        <article
                          key={`${item.type}-${item.id}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                              {item.type}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusStyles(
                                item.status,
                                item.isComplete
                              )}`}
                            >
                              {getStatusLabel(item.status, item.isComplete)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                          {item.secondary ? (
                            <p className="mt-1 text-[11px] text-slate-400">{item.secondary}</p>
                          ) : null}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </SidebarShell>
  );
}
