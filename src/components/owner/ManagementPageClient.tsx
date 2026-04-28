"use client";

import { useState } from "react";
import Link from "next/link";
import CollapsibleCard from "./CollapsibleCard";
import TaskCreateForm from "./TaskCreateForm";
import FloatingCreateButton from "./FloatingCreateButton";
import TaskSidePanel from "./TaskSidePanel";
import ProjectItem from "./ProjectItem";
import { createProject, updateProject, deleteProject } from "./projectActions";
import {
  uiButtonPrimaryClass,
  uiEmptyStateClass,
  uiFieldClass,
  uiKickerClass,
  uiPillClass,
  uiSurfaceClass,
  uiSurfaceMutedClass,
  uiTabActiveClass,
  uiTabClass,
  uiTitleSmClass,
} from "@/components/ui";

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
  if (isComplete) return "ds-pill border-violet-400/30 bg-violet-500/10 text-violet-300";
  const normalized = normalizeStatus(status);
  if (normalized === "doing" || normalized === "in-progress" || normalized === "ongoing") return "ds-pill border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (normalized === "blocked" || normalized === "on-hold") return "ds-pill border-rose-400/30 bg-rose-500/10 text-rose-300";
  if (normalized === "planned" || normalized === "open") return "ds-pill border-sky-400/30 bg-sky-500/10 text-sky-300";
  if (normalized === "done" || normalized === "complete") return "ds-pill border-violet-400/30 bg-violet-500/10 text-violet-300";
  return uiPillClass;
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
              className={`${uiFieldClass} h-10 w-72`}
              required
            />
            <button
              type="submit"
              className={`${uiButtonPrimaryClass} min-h-10 text-xs uppercase tracking-widest`}
            >
              Create Project
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.length === 0 ? (
              <p className="text-sm text-[var(--text-soft)]">No projects yet.</p>
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
          <p className={uiKickerClass}>Task Views</p>
          <h2 className={`mt-2 ${uiTitleSmClass}`}>Execution hub</h2>
        </div>
        <div className={`${uiSurfaceClass} inline-flex rounded-xl p-1`}>
          {viewModes.map((mode) => {
            const isActive = activeView === mode.key;
            return (
              <Link
                key={mode.key}
                href={`/management?view=${mode.key}`}
                className={isActive ? uiTabActiveClass : uiTabClass}
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
            <div className="app-table-shell min-w-[760px]">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Project</th>
                    <th>Due</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-5 text-sm text-[var(--text-soft)]">
                        No tasks yet. Create your first task above.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr
                        key={task.id}
                        className="cursor-pointer transition hover:bg-[var(--input-bg-strong)]"
                        onClick={() => handleTaskClick(task)}
                      >
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--input-bg-strong)] text-[10px] font-semibold text-[var(--text-muted)]">
                              {getInitials(task.title)}
                            </span>
                            <div>
                              <p className="text-[13px] font-semibold text-[var(--text)]">{task.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <span className={`px-2.5 py-0.5 text-[10px] font-semibold ${getStatusStyles(task.status, task.is_complete)}`}>
                            {getStatusLabel(task.status, task.is_complete)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-[var(--text-muted)]">{task.project?.name ?? "Unassigned"}</td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-[var(--text-muted)]">{formatDate(task.due_date)}</td>
                        <td className="px-4 py-2.5 align-middle text-[13px] text-[var(--text-muted)]">{task.priority ?? "TBD"}</td>
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
                <div key={column.key} className={`${uiSurfaceClass} flex h-full w-72 flex-shrink-0 flex-col p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={uiKickerClass}>{column.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">{column.hint}</p>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{column.tasks.length}</span>
                  </div>
                  <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
                    {column.tasks.length === 0 ? (
                      <div className={`${uiEmptyStateClass} text-xs`}>Nothing here yet.</div>
                    ) : (
                      column.tasks.map((task) => (
                        <article
                          key={task.id}
                          className={`${uiSurfaceMutedClass} cursor-pointer px-3 py-3 transition hover:border-[var(--line-focus)] hover:bg-[var(--input-bg-strong)]`}
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="flex items-center justify-between">
                            <span className={uiKickerClass}>Task</span>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold ${getStatusStyles(task.status, task.is_complete)}`}>
                              {getStatusLabel(task.status, task.is_complete)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[var(--text)]">{task.title}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{task.project?.name ?? "Unassigned"}</p>
                          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{formatDate(task.due_date)}</p>
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
              <div className={uiEmptyStateClass}>No tasks available.</div>
            ) : (
              calendarBuckets.map((bucket) => (
                <article key={bucket.date} className={`${uiSurfaceClass} p-4`}>
                  <h3 className="text-sm font-semibold text-[var(--text)]">
                    {bucket.date === "unscheduled" ? "No due date" : formatDate(bucket.date)}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{bucket.tasks.length} task{bucket.tasks.length === 1 ? "" : "s"}</p>
                  <div className="mt-3 space-y-2">
                    {bucket.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`${uiSurfaceMutedClass} cursor-pointer px-3 py-2 transition hover:border-[var(--line-focus)] hover:bg-[var(--input-bg-strong)]`}
                        onClick={() => handleTaskClick(task)}
                      >
                        <p className="text-sm font-medium text-[var(--text)]">{task.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{task.project?.name ?? "Unassigned"}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}

        {activeView === "gantt" ? (
          <div className={`${uiSurfaceClass} space-y-3 p-4`}>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>{formatDate(timelineStart.toISOString())}</span>
              <span>{formatDate(timelineEnd.toISOString())}</span>
            </div>
            {datedTasks.length === 0 ? (
              <div className={uiEmptyStateClass}>
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
                    className="grid cursor-pointer grid-cols-[240px_1fr] items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-[var(--input-bg)]"
                    onClick={() => handleTaskClick(task)}
                  >
                    <div>
                      <p className="truncate text-sm font-medium text-[var(--text)]">{task.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{task.project?.name ?? "Unassigned"}</p>
                    </div>
                    <div className="relative h-7 rounded-lg bg-[var(--input-bg-strong)]">
                      <div
                        className="absolute top-1 h-5 cursor-pointer rounded-md bg-gradient-to-r from-[var(--cyan)] to-[var(--violet)]"
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
