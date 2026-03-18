"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProjectOption = {
  id: string;
  name: string;
};

type FloatingCreateButtonProps = {
  projects: ProjectOption[];
};

export default function FloatingCreateButton({ projects }: FloatingCreateButtonProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      if (projectId) formData.set("projectId", projectId);
      if (dueDate) formData.set("dueDate", dueDate);
      if (priority) formData.set("priority", priority);

      const response = await fetch("/api/tasks", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setTitle("");
        setProjectId("");
        setDueDate("");
        setPriority("");
        setIsExpanded(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-30">
      {isExpanded && (
        <div className="absolute bottom-16 right-0 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400"
              autoFocus
              required
            />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="">Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_8px_20px_rgba(2,132,199,0.35)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all ${
          isExpanded
            ? "bg-slate-500 hover:bg-slate-600 rotate-45"
            : "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500"
        }`}
      >
        <svg
          className={`h-6 w-6 text-white transition-transform ${isExpanded ? "rotate-0" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
