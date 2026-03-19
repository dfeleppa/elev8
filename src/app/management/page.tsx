import { redirect } from "next/navigation";

import SidebarShell from "../../components/SidebarShell";
import ManagementPageClient from "../../components/owner/ManagementPageClient";
import { hasRole, requireUserContext } from "../../lib/member";
import { supabaseAdmin } from "../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type ViewMode = "list" | "kanban" | "calendar" | "gantt";

type Task = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  is_complete: boolean | null;
  notes: string | null;
  created_at: string | null;
  project_id: string | null;
  project: { id: string; name: string } | null;
};

type TaskRow = Omit<Task, "project"> & {
  project: { id: string; name: string }[] | null;
};

type ProjectOption = {
  id: string;
  name: string;
};

async function getTasks(memberId: string): Promise<Task[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, title, status, due_date, priority, is_complete, notes, created_at, project_id, project:projects(id, name)")
    .eq("member_id", memberId)
    .order("due_date", { ascending: true, nullsFirst: false });

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

async function getProjects(memberId: string): Promise<ProjectOption[]> {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, name")
    .eq("member_id", memberId)
    .order("name", { ascending: true });

  return data ?? [];
}

const viewModes: Array<{ key: ViewMode; label: string }> = [
  { key: "list", label: "List" },
  { key: "kanban", label: "Kanban" },
  { key: "calendar", label: "Calendar" },
  { key: "gantt", label: "Gantt" },
];

export default async function ManagementPage({
  searchParams,
}: {
  searchParams?: { view?: string | string[] } | Promise<{ view?: string | string[] }>;
}) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const viewParam = Array.isArray(resolvedSearchParams?.view) ? resolvedSearchParams?.view[0] : resolvedSearchParams?.view;
  const normalizedView = viewParam?.trim().toLowerCase();
  const activeView: ViewMode = viewModes.some((mode) => mode.key === normalizedView)
    ? (normalizedView as ViewMode)
    : "list";

  const [tasks, projects] = await Promise.all([getTasks(userId), getProjects(userId)]);

  return (
    <SidebarShell mainClassName="w-full px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Management</h1>
          <p className="mt-3 text-sm text-slate-400">One workspace for task execution across list, kanban, calendar, and gantt.</p>
        </header>

        <ManagementPageClient
          tasks={tasks}
          projects={projects}
          activeView={activeView}
        />
      </section>
    </SidebarShell>
  );
}
