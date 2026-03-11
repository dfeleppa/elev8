"use client";

import { useRef, useState } from "react";

type TrainingSession = {
  id: string;
  title: string;
  scheduled_date: string;
  notes: string | null;
  is_complete: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type TrainingSessionsCardProps = {
  initialSessions: TrainingSession[];
};

const pencilIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="M4 20l4.5-1 9.7-9.7a1.6 1.6 0 0 0 0-2.3l-1.9-1.9a1.6 1.6 0 0 0-2.3 0L4.3 14.8 4 20z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

const xIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6l-12 12"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    />
  </svg>
);

const circleIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const checkCircleIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M9 12.2l2 2.1 4-4.2"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

function formatDate(value: string) {
  if (!value) {
    return "—";
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNotes(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\n/g, "<br />")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export default function TrainingSessionsCard({ initialSessions }: TrainingSessionsCardProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editComplete, setEditComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const editNotesRef = useRef<HTMLTextAreaElement | null>(null);

  async function refreshSessions() {
    const response = await fetch("/api/training-sessions", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load training sessions.");
    }
    const payload = await response.json();
    setSessions(payload.sessions ?? []);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim() || !scheduledDate) {
      setError("Add a title and scheduled date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/training-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scheduledDate, notes, isComplete }),
      });

      if (!response.ok) {
        throw new Error("Unable to create training entry.");
      }

      setTitle("");
      setScheduledDate("");
      setNotes("");
      setIsComplete(false);
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create training entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(entry: TrainingSession) {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditDate(entry.scheduled_date);
    setEditNotes(entry.notes ?? "");
    setEditComplete(Boolean(entry.is_complete));
    setExpandedIds((prev) => new Set(prev).add(entry.id));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDate("");
    setEditNotes("");
    setEditComplete(false);
    setError(null);
  }

  async function handleSave(sessionId: string) {
    setError(null);

    if (!editTitle.trim() || !editDate) {
      setError("Add a title and scheduled date to save changes.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/training-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          scheduledDate: editDate,
          notes: editNotes,
          isComplete: editComplete,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update training entry.");
      }

      await refreshSessions();
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update training entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(sessionId: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/training-sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete training entry.");
      }

      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete training entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleComplete(entry: TrainingSession) {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/training-sessions/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: entry.title,
          scheduledDate: entry.scheduled_date,
          notes: entry.notes ?? "",
          isComplete: !entry.is_complete,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update training status.");
      }

      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update training status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyFormat(target: "create" | "edit", token: "**" | "*" | "__") {
    const textarea = target === "create" ? createNotesRef.current : editNotesRef.current;
    const value = target === "create" ? notes : editNotes;
    const setValue = target === "create" ? setNotes : setEditNotes;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const nextValue = `${value.slice(0, start)}${token}${selected}${token}${value.slice(end)}`;

    setValue(nextValue);

    if (textarea) {
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, end + token.length);
      });
    }
  }

  return (
    <section className="glass-panel rounded-[28px] border border-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Training</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Sessions log</h2>
        </div>
        <p className="text-xs text-slate-400">Complete</p>
      </div>

      <div className="mt-6 space-y-3">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
            Add today&apos;s training below.
          </div>
        ) : (
          sessions.map((entry) => {
            const isExpanded = expandedIds.has(entry.id) || editingId === entry.id;
            return (
            <div
              key={entry.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  {editingId === entry.id ? (
                    <>
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder="Session title"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={editDate}
                        onChange={(event) => setEditDate(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      />
                      {isExpanded && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => applyFormat("edit", "**")}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30"
                          >
                            Bold
                          </button>
                          <button
                            type="button"
                            onClick={() => applyFormat("edit", "*")}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30"
                          >
                            Italic
                          </button>
                          <button
                            type="button"
                            onClick={() => applyFormat("edit", "__")}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30"
                          >
                            Underline
                          </button>
                        </div>
                      )}
                      {isExpanded && (
                        <textarea
                          ref={editNotesRef}
                          value={editNotes}
                          onChange={(event) => setEditNotes(event.target.value)}
                          placeholder="Training details"
                          rows={4}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                        {formatDate(entry.scheduled_date)}
                      </p>
                      <p className="text-base font-semibold text-slate-50">{entry.title}</p>
                      {isExpanded && (
                        <p
                          className="text-sm text-slate-100"
                          dangerouslySetInnerHTML={{
                            __html: formatNotes(entry.notes || "No notes yet."),
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {editingId === entry.id ? (
                    <>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={editComplete}
                          onChange={(event) => setEditComplete(event.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-slate-100"
                        />
                        Complete
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSave(entry.id)}
                        disabled={isSubmitting}
                        className="rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-slate-100 transition hover:border-white/30 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleComplete(entry)}
                        disabled={isSubmitting}
                        className={`rounded-full border p-2 transition disabled:opacity-60 ${
                          entry.is_complete
                            ? "border-emerald-300 text-emerald-200"
                            : "border-white/10 text-slate-300 hover:border-white/30 hover:text-slate-100"
                        }`}
                        aria-label={entry.is_complete ? "Mark incomplete" : "Mark complete"}
                      >
                        {entry.is_complete ? checkCircleIcon : circleIcon}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                        aria-label="Edit session"
                      >
                        {pencilIcon}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isSubmitting}
                        className="rounded-full border border-white/10 p-2 text-rose-200 transition hover:border-rose-200 hover:text-rose-100 disabled:opacity-60"
                        aria-label="Remove session"
                      >
                        {xIcon}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(entry.id)) {
                              next.delete(entry.id);
                            } else {
                              next.add(entry.id);
                            }
                            return next;
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                        aria-label={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : "rotate-0"}`}
                          aria-hidden="true"
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.6"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
            })
        )}
      </div>

      <form onSubmit={handleCreate} className="mt-6 space-y-3">
        <div className="flex flex-col gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Session title"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
            />
          <input
            type="date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyFormat("create", "**")}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30"
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => applyFormat("create", "*")}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30"
            >
              Italic
            </button>
            <button
              type="button"
              onClick={() => applyFormat("create", "__")}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30"
            >
              Underline
            </button>
          </div>
          <textarea
            ref={createNotesRef}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Today's training notes"
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={isComplete}
            onChange={(event) => setIsComplete(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-slate-100"
          />
          Complete
        </label>
        {error && <p className="text-xs text-rose-200">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-white/10 px-5 py-2 text-xs uppercase tracking-[0.3em] text-slate-100 transition hover:border-white/30 disabled:opacity-60"
        >
          Add training
        </button>
      </form>
    </section>
  );
}
