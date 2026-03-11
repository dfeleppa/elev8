"use client";

import { useMemo, useState } from "react";

type TrainingSession = {
  id: string;
  title: string;
  scheduled_date: string;
  notes: string | null;
  is_complete: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type WeekDay = {
  label: string;
  date: string;
};

type WeeklyTrainingBoardProps = {
  initialSessions: TrainingSession[];
  weekDays: WeekDay[];
};

export default function WeeklyTrainingBoard({ initialSessions, weekDays }: WeeklyTrainingBoardProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionsByDay = useMemo(() => {
    return weekDays.map((day) => {
      const entries = sessions.filter((session) => session.scheduled_date === day.date);
      return { ...day, entries };
    });
  }, [sessions, weekDays]);

  async function persistSession(updated: TrainingSession) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/training-sessions/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updated.title,
          scheduledDate: updated.scheduled_date,
          notes: updated.notes ?? "",
          isComplete: Boolean(updated.is_complete),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update training session.");
      }

      const payload = await response.json();
      const saved = payload.session as TrainingSession;
      setSessions((prev) => prev.map((entry) => (entry.id === saved.id ? saved : entry)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update training session.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(entry: TrainingSession) {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditNotes(entry.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditNotes("");
  }

  async function handleSave(entry: TrainingSession) {
    if (!editTitle.trim()) {
      setError("Add a title to save changes.");
      return;
    }

    await persistSession({
      ...entry,
      title: editTitle.trim(),
      notes: editNotes.trim(),
    });
  }

  async function handleDrop(sessionId: string, targetDate: string) {
    const entry = sessions.find((session) => session.id === sessionId);
    if (!entry || entry.scheduled_date === targetDate) {
      return;
    }

    await persistSession({
      ...entry,
      scheduled_date: targetDate,
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-7">
        {sessionsByDay.map((day) => (
          <section
            key={day.date}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const sessionId = event.dataTransfer.getData("text/plain");
              if (sessionId) {
                void handleDrop(sessionId, day.date);
              }
            }}
            className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{day.label}</p>
            <div className="mt-4 space-y-3">
              {day.entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 px-3 py-4 text-xs text-slate-400">
                  No sessions scheduled.
                </div>
              ) : (
                day.entries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <article
                      key={entry.id}
                      draggable={!isEditing}
                      onDragStart={(event) => {
                        setDraggingId(entry.id);
                        event.dataTransfer.setData("text/plain", entry.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`rounded-2xl border border-white/10 bg-[#2e3bbb] px-3 py-3 text-xs text-white shadow-sm transition ${
                        draggingId === entry.id ? "opacity-70" : ""
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder-white/60 focus:border-white/40 focus:outline-none"
                            placeholder="Session title"
                          />
                          <textarea
                            value={editNotes}
                            onChange={(event) => setEditNotes(event.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white placeholder-white/60 focus:border-white/40 focus:outline-none"
                            placeholder="Notes"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSave(entry)}
                              disabled={isSaving}
                              className="rounded-full border border-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white transition hover:border-white/60 disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80 transition hover:border-white/50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-white">{entry.title}</p>
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60"
                            >
                              Edit
                            </button>
                          </div>
                          {entry.notes ? (
                            <p className="mt-2 whitespace-pre-wrap text-[11px] text-white/90">
                              {entry.notes}
                            </p>
                          ) : null}
                        </>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
