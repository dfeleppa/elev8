"use client";

import { useState } from "react";
import Link from "next/link";
import CollapsibleCard from "./CollapsibleCard";
import TaskCreateForm from "./TaskCreateForm";
import FloatingCreateButton from "./FloatingCreateButton";
import TaskSidePanel from "./TaskSidePanel";
import ProjectItem from "./ProjectItem";
import { createProject, updateProject, deleteProject } from "./projectActions";

type ViewMode = "list" | "kanban" | "calendar" | "gantt";
type KanbanColumnKey = "planned" | "in-progress" | "blocked" | "done";

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

type ProjectOption = {
  id: string;
  name: string;
};

type CalendarBucket = {
  date: string;
  tasks: Task[];
};

const viewModes: Array<{ key: ViewMode; label: string }> = [
  { key: "list", label: "List" },
  { key: "kanban", label: "Kanban" },
  { key: "calendar", label: "Calendar" },
  { key: "gantt", label: "Gantt" },
];

const kanbanColumns: Array<{ key: KanbanColumnKey; label: string; hint: string }> = [
  { key: "planned", label: "Planned", hint: "Queued" },
  { key: "in-progress", label: "In Progress", hint: "Active" },
  { key: "blocked", label: "Blocked", hint: "Needs help" },
  { key: "done", label: "Done", hint: "Shipped" },
];

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeStatus(status: string | null) {
  return status?.trim().toLowerCase().replace(/[_\s]+/g, "-") ?? "";
}

function getStatusLabel(status: string | null, isComplete?: boolean | null) {
  if (isComplete) return "Done";
  const normalized = normalizeStatus(status);
  if (!normalized) return "Planned";
  if (normalized === "in-progress") return "In progress";
  return normalized.split("-").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function getStatusStyles(status: string | null, isComplete?: boolean | null) {
  if (isComplete) return "border-violet-200 bg-violet-50 text-violet-700";
  const normalized = normalizeStatus(status);
  if (normalized === "doing" || normalized === "in-progress" || normalized === "ongoing") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "blocked" || normalized === "on-hold") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "planned" || normalized === "open") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "done" || normalized === "complete") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-white text-slate-600";
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getColumnKey(status: string | null, isComplete?: boolean | null): KanbanColumnKey {
  if (isComplete) return "done";
  const normalized = normalizeStatus(status);
  if (normalized === "done" || normalized === "complete") return "done";
  if (normalized === "blocked" || normalized === "on-hold") return "blocked";
  if (normalized === "doing" || normalized === "in-progress" || normalized === "ongoing") return "in-progress";
  return "planned";
}

function toDateKey(value: string | null) {
  if (!value) return "unscheduled";
  return new Date(value).toISOString().slice(0, 10);
}

function getCalendarBuckets(tasks: Task[]): CalendarBucket[] {
  const byDate = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = toDateKey(task.due_date);
    byDate.set(key, [...(byDate.get(key) ?? []), task]);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => {
      if (a === "unscheduled") return 1;
      if (b === "unscheduled") return -1;
      return a.localeCompare(b);
    })
    .map(([date, groupedTasks]) => ({ date, tasks: groupedTasks }));
}

function daysBetween(a: Date, b: Date) {
  const millisPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / millisPerDay));
}

type ManagementPageClientProps = {
  tasks: Task[];
  projects: ProjectOption[];
  activeView: ViewMode;
};

export default function ManagementPageClient({
  tasks,
  projects,
  activeView,
}: ManagementPageClientProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const calendarBuckets = getCalendarBuckets(tasks);
  const taskCountByColumn = kanbanColumns.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => getColumnKey(task.status, task.is_complete) === column.key),
  }));

  const datedTasks = tasks.filter((task) => task.due_date).map((task) => ({
    ...task,
    start: new Date(task.created_at ?? task.due_date ?? new Date().toISOString()),
    end: new Date(task.due_date ?? new Date().toISOString()),
  }));

  const timelineStart = datedTasks.length ? new Date(Math.min(...datedTasks.map((task) => task.start.getTime()))) : new Date();
  const timelineEnd = datedTasks.length ? new Date(Math.max(...datedTasks.map((task) => task.end.getTime()))) : new Date();
  const timelineSpan = Math.max(1, daysBetween(timelineStart, timelineEnd) + 1);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleSidePanelClose = () => {
    setSelectedTask(null);
  };

  return (
    <>
      <div className="mb-6">
        <CollapsibleCard
          title="Create Project"
          meta="Projects"
          defaultCollapsed={true}
          storageKey="projects-card-collapsed"
        >
          <form
            action={createProject}
            className="flex flex-wrap items-center gap-3"
          >
            <input
              type="text"
              name="name"
              placeholder="Project name"
              className="h-10 w-72 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_8px_20px_rgba(2,132,199,0.35)] transition hover:from-sky-400 hover:to-blue-500"
            >
              Create Project
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.length === 0 ? (
              <p className="text-sm text-slate-500">No projects yet.</p>
            ) : (
              projects.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  onUpdate={updateProject}
                  onDelete={deleteProject}
                />
              ))
            )}
          </div>
        </CollapsibleCard>
      </div>

      <div className="mb-6">
        <CollapsibleCard
          title="Create Task"
          meta="Tasks"
          defaultCollapsed={true}
          storageKey="create-task-card-collapsed"
        >
          <TaskCreateForm projects={projects} />
        </CollapsibleCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Task Views</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Execution hub</h2>
        </div>
        <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
          {viewModes.map((mode) => {
            const isActive = activeView === mode.key;
            return (
              <Link
                key={mode.key}
                href={`/management?view=${mode.key}`}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {mode.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        {activeView === "list" ? (
          <div className="space-y-4">
            <div className="min-w-[760px] overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 text-left text-[11px] font-semibold uppercase tracking-[0.26em] text-white">
                    <th className="px-4 py-2.5">Task</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Project</th>
                    <th className="px-4 py-2.5">Due</th>
                    <th className="px-4 py-2.5">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-5 text-sm text-slate-500">
                        No tasks yet. Create your first task above.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr
                        key={task.id}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => handleTaskClick(task)}
                      >
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-600">
                              {getInitials(task.title)}
                            </span>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-900">{task.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusStyles(task.status, task.is_complete)}`}>
                            {getStatusLabel(task.status, task.is_complete)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{task.project?.name ?? "Unassigned"}</td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{formatDate(task.due_date)}</td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{task.priority ?? "TBD"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeView === "kanban" ? (
          <div className="overflow-x-auto">
            <div className="flex min-h-[55vh] gap-4 items-stretch">
              {taskCountByColumn.map((column) => (
                <div key={column.key} className="flex h-full w-72 flex-shrink-0 flex-col rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{column.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{column.hint}</p>
                    </div>
                    <span className="text-xs text-slate-400">{column.tasks.length}</span>
                  </div>
                  <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
                    {column.tasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-400">Nothing here yet.</div>
                    ) : (
                      column.tasks.map((task) => (
                        <article
                          key={task.id}
                          className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 shadow-sm transition hover:border-slate-300 hover:bg-slate-100/50"
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Task</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusStyles(task.status, task.is_complete)}`}>
                              {getStatusLabel(task.status, task.is_complete)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{task.project?.name ?? "Unassigned"}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{formatDate(task.due_date)}</p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeView === "calendar" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {calendarBuckets.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">No tasks available.</div>
            ) : (
              calendarBuckets.map((bucket) => (
                <article key={bucket.date} className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {bucket.date === "unscheduled" ? "No due date" : formatDate(bucket.date)}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{bucket.tasks.length} task{bucket.tasks.length === 1 ? "" : "s"}</p>
                  <div className="mt-3 space-y-2">
                    {bucket.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-100"
                        onClick={() => handleTaskClick(task)}
                      >
                        <p className="text-sm font-medium text-slate-900">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.project?.name ?? "Unassigned"}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}

        {activeView === "gantt" ? (
          <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formatDate(timelineStart.toISOString())}</span>
              <span>{formatDate(timelineEnd.toISOString())}</span>
            </div>
            {datedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Add due dates to tasks to populate the gantt timeline.
              </div>
            ) : (
              datedTasks.map((task) => {
                const startOffset = daysBetween(timelineStart, task.start);
                const duration = Math.max(1, daysBetween(task.start, task.end) + 1);
                const left = (startOffset / timelineSpan) * 100;
                const width = (duration / timelineSpan) * 100;
                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[240px_1fr] items-center gap-3 cursor-pointer transition hover:bg-slate-50 rounded-lg px-2 py-1"
                    onClick={() => handleTaskClick(task)}
                  >
                    <div>
                      <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.project?.name ?? "Unassigned"}</p>
                    </div>
                    <div className="relative h-7 rounded-lg bg-slate-100">
                      <div
                        className="absolute top-1 h-5 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 cursor-pointer"
                        style={{ left: `${Math.min(left, 98)}%`, width: `${Math.max(width, 2)}%` }}
                        title={`${formatDate(task.created_at)} -> ${formatDate(task.due_date)}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <FloatingCreateButton projects={projects} />

      <TaskSidePanel
        task={selectedTask}
        projects={projects}
        onClose={handleSidePanelClose}
      />
    </>
  );
}
