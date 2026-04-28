"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ownerIconButtonNeutralClass, ownerIconButtonDangerClass, ownerIconButtonSuccessClass } from "./buttonStyles";
import { uiFieldClass, uiPillClass, uiPillInfoClass } from "@/components/ui";

type Project = {
  id: string;
  name: string;
};

type ProjectItemProps = {
  project: Project;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function ProjectItem({ project, onUpdate, onDelete }: ProjectItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === project.name) {
      setIsEditing(false);
      setEditName(project.name);
      return;
    }

    setIsLoading(true);
    try {
      await onUpdate(project.id, trimmed);
      router.refresh();
      setIsEditing(false);
    } catch {
      setEditName(project.name);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName(project.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project.name}"?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await onDelete(project.id);
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 ${uiPillInfoClass}`}>
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${uiFieldClass} h-6 w-32 rounded-md px-2 py-1 text-xs`}
          disabled={isLoading}
        />
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={ownerIconButtonSuccessClass}
          title="Save"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className={ownerIconButtonDangerClass}
          title="Cancel"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 ${uiPillClass}`}>
      <span className="text-xs font-medium text-[var(--text)]">{project.name}</span>
      <button
        onClick={() => setIsEditing(true)}
        disabled={isLoading}
        className={ownerIconButtonNeutralClass}
        title="Edit"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        onClick={handleDelete}
        disabled={isLoading}
        className={ownerIconButtonDangerClass}
        title="Delete"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
