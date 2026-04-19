"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Plus,
  Repeat2,
  Snowflake,
  Trash2,
  X,
} from "lucide-react";

import ProgrammingSubheader from "../../../../../../components/admin/ProgrammingSubheader";
import LiftProgressionGrid from "../../../../../../components/admin/programs/LiftProgressionGrid";
import ConditioningProgressionGrid from "../../../../../../components/admin/programs/ConditioningProgressionGrid";
import AssignmentPanel from "../../../../../../components/admin/programs/AssignmentPanel";
import type { Program, ProgramTemplateBlock, ProgramTemplateDayWithBlocks } from "../../../../../../lib/programs";
import { WORKOUT_BLOCK_TYPES } from "../../../../../../lib/programming";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BLOCK_TYPE_ICON: Record<string, React.ReactNode> = {
  warmup: <Flame className="h-3 w-3" />,
  lift: <Dumbbell className="h-3 w-3" />,
  workout: <Repeat2 className="h-3 w-3" />,
  cooldown: <Snowflake className="h-3 w-3" />,
};

const BLOCK_TYPE_COLOR: Record<string, string> = {
  warmup: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  lift: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  workout: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  cooldown: "border-teal-400/30 bg-teal-400/10 text-teal-300",
};

const STATUS_OPTIONS = ["draft", "published", "archived"] as const;

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none";

const btnPrimary =
  "rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60";

const btnSecondary =
  "rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10";

type PanelTab = "details" | "lift" | "conditioning";

export default function ProgramBuilderEditor() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();

  const [program, setProgram] = useState<Program | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [days, setDays] = useState<ProgramTemplateDayWithBlocks[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  // Block panel
  const [selectedBlock, setSelectedBlock] = useState<ProgramTemplateBlock | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("details");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScoreType, setEditScoreType] = useState("none");
  const [savingBlock, setSavingBlock] = useState(false);

  // Assignment panel
  const [showAssignments, setShowAssignments] = useState(false);

  // Add-block dropdown
  const [addingToDay, setAddingToDay] = useState<{ weekNumber: number; dayOfWeek: number } | null>(null);

  const addDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/programming/programs/${programId}`);
        const data = await res.json();
        if (!isMounted) return;
        setProgram(data.program);
        setDays(data.days ?? []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [programId]);

  // Close add-block dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setAddingToDay(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleStatusChange(status: string) {
    if (!program) return;
    setSavingStatus(true);
    const res = await fetch(`/api/programming/programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) setProgram(data.program);
    setSavingStatus(false);
  }

  function getDayBlocks(weekNumber: number, dayOfWeek: number): ProgramTemplateBlock[] {
    const day = days.find((d) => d.week_number === weekNumber && d.day_of_week === dayOfWeek);
    return (day?.program_template_blocks ?? []).sort((a, b) => a.block_order - b.block_order);
  }

  function getDayId(weekNumber: number, dayOfWeek: number): string | null {
    return days.find((d) => d.week_number === weekNumber && d.day_of_week === dayOfWeek)?.id ?? null;
  }

  async function ensureDay(weekNumber: number, dayOfWeek: number): Promise<string | null> {
    const existing = getDayId(weekNumber, dayOfWeek);
    if (existing) return existing;

    const res = await fetch(`/api/programming/programs/${programId}/days`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekNumber, dayOfWeek }),
    });
    const data = await res.json();
    if (!res.ok || !data.day) return null;

    setDays((prev) => [
      ...prev,
      { ...data.day, program_template_blocks: [] },
    ]);
    return data.day.id;
  }

  async function handleAddBlock(weekNumber: number, dayOfWeek: number, blockType: string) {
    setAddingToDay(null);
    const templateDayId = await ensureDay(weekNumber, dayOfWeek);
    if (!templateDayId) return;

    const existingBlocks = getDayBlocks(weekNumber, dayOfWeek);
    const res = await fetch(`/api/programming/programs/${programId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateDayId,
        blockType,
        title: blockType.charAt(0).toUpperCase() + blockType.slice(1),
        scoreType: "none",
        blockOrder: existingBlocks.length,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.block) return;

    setDays((prev) =>
      prev.map((d) =>
        d.id === templateDayId
          ? { ...d, program_template_blocks: [...(d.program_template_blocks ?? []), data.block] }
          : d
      )
    );

    openBlock(data.block);
  }

  function openBlock(block: ProgramTemplateBlock) {
    setSelectedBlock(block);
    setEditTitle(block.title);
    setEditDescription(block.description ?? "");
    setEditScoreType(block.score_type);
    setPanelTab("details");
  }

  async function handleSaveBlock() {
    if (!selectedBlock) return;
    setSavingBlock(true);
    const res = await fetch(`/api/programming/programs/${programId}/blocks/${selectedBlock.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription || null,
        scoreType: editScoreType,
      }),
    });
    const data = await res.json();
    if (res.ok && data.block) {
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          program_template_blocks: (d.program_template_blocks ?? []).map((b) =>
            b.id === data.block.id ? data.block : b
          ),
        }))
      );
      setSelectedBlock(data.block);
    }
    setSavingBlock(false);
  }

  async function handleDeleteBlock(block: ProgramTemplateBlock) {
    if (!confirm("Delete this block?")) return;
    await fetch(`/api/programming/programs/${programId}/blocks/${block.id}`, { method: "DELETE" });
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        program_template_blocks: (d.program_template_blocks ?? []).filter((b) => b.id !== block.id),
      }))
    );
    if (selectedBlock?.id === block.id) setSelectedBlock(null);
  }

  if (loading) {
    return (
      <>
        <ProgrammingSubheader />
        <div className="px-5 py-10 text-sm text-slate-500">Loading...</div>
      </>
    );
  }

  if (!program) {
    return (
      <>
        <ProgrammingSubheader />
        <div className="px-5 py-10 text-sm text-rose-400">Program not found.</div>
      </>
    );
  }

  const activeDays = program.days_per_week;
  const dayIndices = Array.from({ length: activeDays }, (_, i) => i + 1); // 1-based day_of_week

  return (
    <>
      <ProgrammingSubheader />

      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-3">
        <button
          type="button"
          onClick={() => router.push("/admin/programming/builder")}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Programs
        </button>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-semibold text-slate-200 truncate max-w-xs">{program.name}</span>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={program.status}
            disabled={savingStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAssignments(true)}
            className={btnSecondary}
          >
            Assign
          </button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-2.5">
        <button
          type="button"
          disabled={currentWeek <= 1}
          onClick={() => setCurrentWeek((w) => w - 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-slate-200">
          Week {currentWeek} <span className="text-slate-500">/ {program.duration_weeks}</span>
        </span>
        <button
          type="button"
          disabled={currentWeek >= program.duration_weeks}
          onClick={() => setCurrentWeek((w) => w + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main layout: day grid + block panel */}
      <div className="flex min-h-0 flex-1">
        {/* Day columns */}
        <div className="flex-1 overflow-x-auto">
          <div
            className="grid min-w-0 gap-px bg-white/5 p-px"
            style={{ gridTemplateColumns: `repeat(${activeDays}, minmax(160px, 1fr))` }}
          >
            {dayIndices.map((dow) => {
              const blocks = getDayBlocks(currentWeek, dow);
              const isAdding = addingToDay?.weekNumber === currentWeek && addingToDay?.dayOfWeek === dow;

              return (
                <div key={dow} className="flex flex-col bg-[#0d0f14] px-2 py-3 min-h-[420px]">
                  {/* Day header */}
                  <div className="mb-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {DOW_LABELS[dow - 1]}
                  </div>

                  {/* Blocks */}
                  <div className="flex flex-col gap-2 flex-1">
                    {blocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => openBlock(block)}
                        className={`group relative w-full rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                          selectedBlock?.id === block.id
                            ? BLOCK_TYPE_COLOR[block.block_type]
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={BLOCK_TYPE_COLOR[block.block_type].split(" ").slice(-1)[0]}>
                            {BLOCK_TYPE_ICON[block.block_type]}
                          </span>
                          <span className="font-semibold truncate">{block.title}</span>
                        </div>
                        <span className="text-slate-500 text-[10px]">{block.score_type}</span>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block); }}
                          className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-md text-rose-400 hover:bg-rose-400/20 group-hover:flex"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </button>
                    ))}
                  </div>

                  {/* Add block */}
                  <div className="relative mt-2" ref={isAdding ? addDropdownRef : null}>
                    <button
                      type="button"
                      onClick={() => setAddingToDay(isAdding ? null : { weekNumber: currentWeek, dayOfWeek: dow })}
                      className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 py-2 text-xs text-slate-600 transition hover:border-indigo-500/40 hover:text-indigo-400"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>

                    {isAdding && (
                      <div className="absolute bottom-full left-0 z-20 mb-1 w-40 rounded-xl border border-white/15 bg-[#181b23] py-1 shadow-xl">
                        {WORKOUT_BLOCK_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleAddBlock(currentWeek, dow, type)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 capitalize"
                          >
                            <span className={BLOCK_TYPE_COLOR[type].split(" ").slice(-1)[0]}>
                              {BLOCK_TYPE_ICON[type]}
                            </span>
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Block editor panel */}
        {selectedBlock && (
          <aside className="w-80 shrink-0 border-l border-white/10 bg-[#0d0f14] flex flex-col overflow-y-auto">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-slate-200 truncate">{selectedBlock.title}</span>
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="ml-2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {(["details", "lift", "conditioning"] as PanelTab[]).map((tab) => {
                if (tab === "lift" && selectedBlock.block_type !== "lift") return null;
                if (tab === "conditioning" && selectedBlock.block_type !== "workout") return null;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPanelTab(tab)}
                    className={`flex-1 py-2 text-xs font-medium capitalize transition ${
                      panelTab === tab
                        ? "border-b-2 border-indigo-400 text-indigo-300"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Panel content */}
            <div className="flex-1 p-4">
              {panelTab === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-400">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-400">Instructions / Notes</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-400">Score Type</label>
                    <select
                      value={editScoreType}
                      onChange={(e) => setEditScoreType(e.target.value)}
                      className={inputClass}
                    >
                      {["none", "time", "reps", "rounds_reps", "distance", "calories"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={savingBlock}
                    onClick={handleSaveBlock}
                    className={btnPrimary + " w-full justify-center"}
                  >
                    {savingBlock ? "Saving..." : "Save"}
                  </button>
                </div>
              )}

              {panelTab === "lift" && selectedBlock.block_type === "lift" && (
                <LiftProgressionGrid
                  programId={programId}
                  blockId={selectedBlock.id}
                  durationWeeks={program.duration_weeks}
                />
              )}

              {panelTab === "conditioning" && selectedBlock.block_type === "workout" && (
                <ConditioningProgressionGrid
                  programId={programId}
                  blockId={selectedBlock.id}
                  durationWeeks={program.duration_weeks}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Assignment panel */}
      {showAssignments && (
        <AssignmentPanel
          programId={programId}
          onClose={() => setShowAssignments(false)}
        />
      )}
    </>
  );
}
