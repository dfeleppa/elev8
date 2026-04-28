"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  uiButtonGhostClass,
  uiButtonPrimaryClass,
  uiFieldClass,
  uiSelectClass,
  uiSurfaceClass,
} from "@/components/ui";

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
        <div className={`${uiSurfaceClass} absolute bottom-16 right-0 w-80 p-4`}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className={`${uiFieldClass} h-10`}
              autoFocus
              required
            />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`${uiSelectClass} h-9`}
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
                className={`${uiFieldClass} h-9 flex-1`}
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`${uiSelectClass} h-9 flex-1`}
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
                className={`${uiButtonPrimaryClass} flex-1`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className={uiButtonGhostClass}
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
        className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
          isExpanded
            ? "border-[var(--line-strong)] bg-[var(--panel-3)] text-[var(--text)] rotate-45"
            : "border-[color:color-mix(in_srgb,var(--pink)_36%,transparent)] bg-gradient-to-r from-[var(--pink)] to-[color:color-mix(in_srgb,var(--pink)_65%,white_35%)] text-[var(--text-inverse)] shadow-[0_14px_30px_color-mix(in_srgb,var(--pink)_26%,transparent)]"
        }`}
      >
        <svg
          className={`h-6 w-6 transition-transform ${isExpanded ? "rotate-0" : ""}`}
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
