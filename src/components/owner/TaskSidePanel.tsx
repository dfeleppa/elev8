"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import TipTapEditor from "./TipTapEditor";

type ProjectOption = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  project_id: string | null;
  notes: string | null;
};

type TaskSidePanelProps = {
  task: Task | null;
  projects: ProjectOption[];
  onClose: () => void;
};

export default function TaskSidePanel({ task, projects, onClose }: TaskSidePanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setStatus(task.status || "");
      setProjectId(task.project_id || "");
      setDueDate(task.due_date || "");
      setPriority(task.priority || "");
      setNotes(task.notes || "");
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [task]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && task) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [task, onClose]);

  const saveTask = useCallback(async () => {
    if (!task || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: status || null,
          project_id: projectId || null,
          due_date: dueDate || null,
          priority: priority || null,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    } finally {
      setIsSaving(false);
    }
  }, [task, status, projectId, dueDate, priority, notes, isSaving, router]);

  useEffect(() => {
    if (!task) return;
    const timeout = setTimeout(() => {
      saveTask();
    }, 500);
    return () => clearTimeout(timeout);
  }, [task, status, projectId, dueDate, priority, notes, saveTask]);

  if (!task) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/55 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-[#090c0f] shadow-xl transition-transform duration-300 md:w-1/2 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-100">Task Details</h2>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-slate-400">Saving...</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Title
            </label>
            <p className="text-sm font-medium text-slate-100">{task.title}</p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
            >
              <option value="">Planned</option>
              <option value="in-progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-slate-100"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Notes
            </label>
            <TipTapEditor
              content={notes}
              onChange={(html) => setNotes(html)}
              placeholder="Add notes..."
            />
          </div>
        </div>
      </div>
    </>
  );
}
