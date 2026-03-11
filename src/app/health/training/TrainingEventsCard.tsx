"use client";

import { useState } from "react";

type TrainingEvent = {
  id: string;
  name: string;
  event_date: string;
  created_at: string | null;
  updated_at: string | null;
};

type TrainingEventsCardProps = {
  initialEvents: TrainingEvent[];
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

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDaysUntil(value: string) {
  if (!value) {
    return "—";
  }

  const eventDate = parseLocalDate(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (Number.isNaN(diffDays)) {
    return "—";
  }

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays < 0) {
    return "Passed";
  }

  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export default function TrainingEventsCard({ initialEvents }: TrainingEventsCardProps) {
  const [events, setEvents] = useState<TrainingEvent[]>(initialEvents);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshEvents() {
    const response = await fetch("/api/training-events", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load events.");
    }
    const payload = await response.json();
    setEvents(payload.events ?? []);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !eventDate) {
      setError("Add a name and date to create an event.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/training-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), eventDate }),
      });

      if (!response.ok) {
        throw new Error("Unable to create event.");
      }

      setName("");
      setEventDate("");
      await refreshEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(entry: TrainingEvent) {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditDate(entry.event_date);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDate("");
    setError(null);
  }

  async function handleSave(eventId: string) {
    setError(null);

    if (!editName.trim() || !editDate) {
      setError("Add a name and date to save changes.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/training-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), eventDate: editDate }),
      });

      if (!response.ok) {
        throw new Error("Unable to update event.");
      }

      await refreshEvents();
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(eventId: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/training-events/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete event.");
      }

      await refreshEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="glass-panel rounded-[28px] border border-white/5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Events</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Training calendar</h2>
        </div>
        <p className="text-xs text-slate-400">Days until</p>
      </div>

      <div className="mt-6 space-y-3">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
            Add your first training event below.
          </div>
        ) : (
          events.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                {editingId === entry.id ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="Event name"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(event) => setEditDate(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-base font-semibold text-slate-50">{entry.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{entry.event_date}</p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {editingId === entry.id ? (
                  <>
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
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {getDaysUntil(entry.event_date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(entry)}
                      className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                      aria-label="Edit event"
                    >
                      {pencilIcon}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={isSubmitting}
                      className="rounded-full border border-white/10 p-2 text-rose-200 transition hover:border-rose-200 hover:text-rose-100 disabled:opacity-60"
                      aria-label="Remove event"
                    >
                      {xIcon}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleCreate} className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Event name"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          />
          <input
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          />
        </div>
        {error && <p className="text-xs text-rose-200">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-white/10 px-5 py-2 text-xs uppercase tracking-[0.3em] text-slate-100 transition hover:border-white/30 disabled:opacity-60"
        >
          Add event
        </button>
      </form>
    </section>
  );
}
