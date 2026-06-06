"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Dumbbell,
  Layers3,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import ProgrammingSubheader from "@/components/admin/ProgrammingSubheader";
import type { Program } from "@/lib/programs";

const WEEK_PRESETS = [4, 8, 12, 16];
const DAYS_PRESETS = [3, 4, 5, 6, 7];

const STATUS_BADGE: Record<string, string> = {
  draft: "rounded-full bg-[#FF5CA8]/10 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#B4236A]",
  published: "rounded-full bg-[#14D2DC]/12 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#0B7C84]",
  archived: "rounded-full bg-[#101828]/8 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#667085]",
};

const inputClass =
  "w-full rounded-[16px] border border-[#D4DAE4]/85 bg-white/86 px-4 py-2.5 text-sm font-semibold text-[#17141F] placeholder:text-[#98A2B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)] focus:border-[#14D2DC]/50 focus:outline-none";

const btnPrimary =
  "rounded-[18px] bg-[#101828] px-5 py-3 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(16,24,40,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

const btnSecondary =
  "rounded-[18px] border border-[#D4DAE4]/85 bg-white/84 px-5 py-3 text-sm font-extrabold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_18px_rgba(16,24,40,0.06)] transition hover:bg-white";

export default function ProgrammingBuilderClient() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const publishedCount = programs.filter((program) => program.status === "published").length;
  const draftCount = programs.filter((program) => program.status === "draft").length;
  const averageWeeks = programs.length
    ? Math.round(programs.reduce((total, program) => total + program.duration_weeks, 0) / programs.length)
    : 0;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/programming/programs`);
        const data = await res.json();
        if (isMounted) setPrograms(data.programs ?? []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  function openModal() {
    setName("");
    setDescription("");
    setDurationWeeks(8);
    setDaysPerWeek(5);
    setModalError(null);
    setShowModal(true);
  }

  async function handleCreate() {
    if (!name.trim()) { setModalError("Name is required."); return; }

    setCreating(true);
    setModalError(null);
    try {
      const res = await fetch("/api/programming/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, durationWeeks, daysPerWeek }),
      });
      const data = await res.json();
      if (!res.ok) { setModalError(data.error ?? "Failed to create."); return; }
      setShowModal(false);
      router.push(`/admin/programming/builder/${data.program.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(programId: string) {
    if (!confirm("Delete this program and all its data?")) return;
    setDeleting(programId);
    await fetch(`/api/programming/programs/${programId}`, { method: "DELETE" });
    setPrograms((prev) => prev.filter((p) => p.id !== programId));
    setDeleting(null);
  }

  return (
    <>
      <ProgrammingSubheader />

      <section className="programming-builder-dashboard premium-main-glow min-h-[calc(100vh-3.5rem)] space-y-5 px-5 py-5 text-[#17141F] sm:px-8 lg:px-10 lg:py-6 2xl:px-12">
        <header className="relative z-10 flex flex-col items-center gap-3 text-center">
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[#17141F] sm:text-[34px]">
            Program Builder
          </h1>
          <div className="premium-glass-pill flex w-full max-w-[520px] items-center justify-center gap-2 px-4 py-3">
            <Layers3 className="h-5 w-5 shrink-0 text-[#FF5CA8]" aria-hidden="true" />
            <span className="truncate text-[14px] font-extrabold text-[#17141F] sm:text-[15px]">
              Multi-week templates, progressions, and publishing plans
            </span>
          </div>
        </header>

        <section className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.42fr)] lg:items-start lg:gap-5 lg:space-y-0">
          <div className="premium-glass-card min-w-0 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-[18px] font-extrabold text-[#17141F] sm:text-[21px]">
                  <Dumbbell className="h-5 w-5 text-[#FF5CA8]" aria-hidden="true" />
                  Program Library
                </div>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
                  Create reusable training blocks with weekly day structures, lift progressions, and conditioning progressions.
                </p>
              </div>
              <button type="button" onClick={openModal} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF5CA8] px-5 py-3 text-[13px] font-extrabold text-white shadow-[0_14px_28px_rgba(255,92,168,0.24)] transition hover:brightness-105">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Program
              </button>
            </div>

            {loading ? (
              <div className="mt-5 rounded-[22px] border border-[#D4DAE4]/85 bg-white/70 p-8 text-sm font-bold text-[#667085] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                Loading programs...
              </div>
            ) : programs.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-[#D4DAE4]/85 bg-white/70 p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#14D2DC]/12 text-[#0B7C84]">
                  <Sparkles className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mt-4 text-[18px] font-extrabold text-[#17141F]">No programs yet</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">Create your first reusable training template.</p>
                <button
                  type="button"
                  onClick={openModal}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#101828] px-5 py-3 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(16,24,40,0.18)] transition hover:brightness-110"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Program
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {programs.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center justify-between rounded-[22px] border border-[#D4DAE4]/85 bg-white/76 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_10px_24px_rgba(16,24,40,0.055)] transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      onClick={() => router.push(`/admin/programming/builder/${p.id}`)}
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] border border-[#DDE2EA]/85 bg-white/78 text-[#FF5CA8] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
                        <CalendarDays className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-extrabold text-[#17141F]">{p.name}</span>
                          <span className={STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}>{p.status}</span>
                        </div>
                        {p.description ? (
                          <p className="mt-1 truncate text-[12px] font-semibold text-[#667085]">{p.description}</p>
                        ) : (
                          <p className="mt-1 truncate text-[12px] font-semibold text-[#98A2B3]">No description yet</p>
                        )}
                      </div>
                      <div className="hidden shrink-0 items-center gap-1 rounded-full border border-[#D4DAE4]/85 bg-white/78 px-3 py-1.5 text-[12px] font-extrabold text-[#475467] sm:flex">
                        <Clock className="h-3.5 w-3.5 text-[#0B7C84]" aria-hidden="true" />
                        {p.duration_weeks}w · {p.days_per_week}d/wk
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:text-[#17141F]" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      disabled={deleting === p.id}
                      onClick={() => handleDelete(p.id)}
                      className="ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#FF5CA8]/24 bg-[#FF5CA8]/10 text-[#B4236A] transition hover:bg-[#FF5CA8]/16 disabled:opacity-50"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="premium-glass-card flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[18px] font-extrabold text-[#17141F] sm:text-[20px]">
                <Sparkles className="h-5 w-5 text-[#FF5CA8]" aria-hidden="true" />
                Builder Summary
              </div>
              <span className="rounded-full border border-[#DDE2EA] bg-white/78 px-3 py-1 text-[11px] font-extrabold text-[#475467]">
                Templates
              </span>
            </div>

            <div className="mt-4 rounded-[20px] border border-[#DDE2EA]/80 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">Library status</p>
              <p className="mt-1 text-[22px] font-extrabold leading-tight text-[#17141F]">
                {programs.length ? "Ready to build" : "Start a program"}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                Draft templates can be edited, assigned, and published into weekly programming.
              </p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: programs.length, color: "#101828" },
                { label: "Drafts", value: draftCount, color: "#FF5CA8" },
                { label: "Weeks", value: averageWeeks, color: "#14D2DC" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[16px] border border-[#D4DAE4]/85 bg-white/78 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
                  <p className="text-[24px] font-extrabold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#667085]">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <button type="button" onClick={openModal} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#101828] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_14px_28px_rgba(16,24,40,0.18)] transition hover:brightness-110">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Program
              </button>
              <button
                type="button"
                onClick={() => {
                  const published = programs.find((program) => program.status === "published") ?? programs[0];
                  if (published) router.push(`/admin/programming/builder/${published.id}`);
                }}
                disabled={programs.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#14D2DC] px-5 py-3 text-[14px] font-extrabold text-[#071A1C] shadow-[0_14px_28px_rgba(20,210,220,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Dumbbell className="h-4 w-4" aria-hidden="true" />
                Open Latest
              </button>
            </div>

            {publishedCount > 0 ? (
              <div className="mt-4 rounded-[18px] border border-[#14D2DC]/24 bg-[#14D2DC]/10 p-3 text-sm font-bold text-[#0B7C84]">
                {publishedCount} published program{publishedCount === 1 ? "" : "s"} ready for assignment.
              </div>
            ) : null}
          </aside>
        </section>
      </section>

      {/* Create Program Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141F]/38 px-4 backdrop-blur-sm">
          <div className="premium-glass-card w-full max-w-md p-5 text-[#17141F] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">Template</p>
                <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-[#17141F]">New Program</h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#FF5CA8]/10 text-[#B4236A]">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-extrabold text-[#475467]">Program Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 12-Week Strength Block"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-extrabold text-[#475467]">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-extrabold text-[#475467]">Duration</label>
                <div className="flex gap-2 flex-wrap">
                  {WEEK_PRESETS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setDurationWeeks(w)}
                      className={
                        durationWeeks === w
                          ? "rounded-full bg-[#14D2DC] px-3 py-1.5 text-sm font-extrabold text-[#071A1C] shadow-[0_10px_20px_rgba(20,210,220,0.18)]"
                          : "rounded-full border border-[#D4DAE4]/85 bg-white/76 px-3 py-1.5 text-sm font-bold text-[#667085] hover:bg-white hover:text-[#17141F]"
                      }
                    >
                      {w}w
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Math.max(1, Math.min(52, parseInt(e.target.value, 10) || 1)))}
                    className="w-20 rounded-full border border-[#D4DAE4]/85 bg-white/86 px-3 py-1.5 text-center text-sm font-extrabold text-[#17141F] focus:border-[#14D2DC]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-extrabold text-[#475467]">Training Days Per Week</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysPerWeek(d)}
                      className={
                        daysPerWeek === d
                          ? "rounded-full bg-[#14D2DC] px-3 py-1.5 text-sm font-extrabold text-[#071A1C] shadow-[0_10px_20px_rgba(20,210,220,0.18)]"
                          : "rounded-full border border-[#D4DAE4]/85 bg-white/76 px-3 py-1.5 text-sm font-bold text-[#667085] hover:bg-white hover:text-[#17141F]"
                      }
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {modalError && <p className="rounded-[14px] border border-[#FF5CA8]/24 bg-[#FF5CA8]/10 px-3 py-2 text-xs font-bold text-[#B4236A]">{modalError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleCreate} disabled={creating} className={btnPrimary}>
                {creating ? "Creating..." : "Create & Open"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
