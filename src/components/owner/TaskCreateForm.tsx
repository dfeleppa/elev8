"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ownerButtonPrimaryClass } from "./buttonStyles";
import { uiFieldClass, uiSelectClass, uiSurfaceMutedClass } from "@/components/ui";

type ProjectOption = {
  id: string;
  name: string;
};

type TaskCreateFormProps = {
  projects: ProjectOption[];
  onCreated?: () => void;
  compact?: boolean;
};

export default function TaskCreateForm({ projects, onCreated, compact = false }: TaskCreateFormProps) {
  const router = useRouter();
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
        router.refresh();
        onCreated?.();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex flex-wrap items-end gap-3 ${compact ? "" : `${uiSurfaceMutedClass} px-4 py-3`}`}>
      <div className="flex items-center">
        <span className="text-lg text-[var(--text-muted)]">+</span>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task title"
        className={`${uiFieldClass} h-9 w-64 px-3 py-2 text-[13px]`}
        required
      />
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className={`${uiSelectClass} h-9 px-3 py-2 text-[12px]`}
      >
        <option value="">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className={`${uiFieldClass} h-9 px-3 py-2 text-[12px]`}
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className={`${uiSelectClass} h-9 px-3 py-2 text-[12px]`}
      >
        <option value="">Priority</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button
        type="submit"
        disabled={isSubmitting || !title.trim()}
        className={ownerButtonPrimaryClass}
      >
        Create
      </button>
    </form>
  );
}
