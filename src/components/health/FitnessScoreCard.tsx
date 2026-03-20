"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FitnessScoreCardProps = {
  strengthPowerScore?: number;
  strengthOlympicScore?: number;
  strengthGymnasticScore?: number;
  conditioningShortScore?: number;
  conditioningMediumScore?: number;
  conditioningLongScore?: number;
};

type ScoreRowProps = {
  label: string;
  score: number;
  tone: "strength" | "conditioning";
  compact?: boolean;
};

const toneClasses: Record<ScoreRowProps["tone"], string> = {
  strength: "bg-cyan-400",
  conditioning: "bg-emerald-400",
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ScoreRow({ label, score, tone, compact = false }: ScoreRowProps) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between ${compact ? "text-xs" : "text-sm"}`}>
        <span className={`${compact ? "font-medium text-slate-300" : "font-semibold text-slate-200"}`}>{label}</span>
        <span className="font-semibold text-slate-100">{score}</span>
      </div>
      <div className={`${compact ? "h-2" : "h-2.5"} w-full rounded-full bg-white/10`}>
        <div
          className={`h-full rounded-full transition-all ${toneClasses[tone]}`}
          style={{ width: `${score}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default function FitnessScoreCard({
  strengthPowerScore = 74,
  strengthOlympicScore = 69,
  strengthGymnasticScore = 72,
  conditioningShortScore = 76,
  conditioningMediumScore = 68,
  conditioningLongScore = 63,
}: FitnessScoreCardProps) {
  const [strengthExpanded, setStrengthExpanded] = useState(false);
  const [conditioningExpanded, setConditioningExpanded] = useState(false);

  const strengthPower = clampScore(strengthPowerScore);
  const strengthOlympic = clampScore(strengthOlympicScore);
  const strengthGymnastic = clampScore(strengthGymnasticScore);

  const conditioningShort = clampScore(conditioningShortScore);
  const conditioningMedium = clampScore(conditioningMediumScore);
  const conditioningLong = clampScore(conditioningLongScore);

  const strengthScore = Math.round((strengthPower + strengthOlympic + strengthGymnastic) / 3);
  const conditioningScore = Math.round((conditioningShort + conditioningMedium + conditioningLong) / 3);
  const fitnessScore = Math.round((strengthScore + conditioningScore) / 2);

  return (
    <section className="glass-panel rounded-3xl border border-white/10 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Fitness Score</p>
          <h2 className="mt-2 text-4xl font-semibold text-slate-100">{fitnessScore}</h2>
          <p className="mt-1 text-sm text-slate-400">Average of Strength and Conditioning</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ScoreRow label="Strength Score" score={strengthScore} tone="strength" />
            </div>
            <button
              type="button"
              onClick={() => setStrengthExpanded((v) => !v)}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/25 hover:text-white"
              aria-label={strengthExpanded ? "Collapse strength details" : "Expand strength details"}
              aria-expanded={strengthExpanded}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${strengthExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {strengthExpanded ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
              <ScoreRow label="Power" score={strengthPower} tone="strength" compact />
              <ScoreRow label="Olympic" score={strengthOlympic} tone="strength" compact />
              <ScoreRow label="Gymnastic" score={strengthGymnastic} tone="strength" compact />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ScoreRow label="Conditioning Score" score={conditioningScore} tone="conditioning" />
            </div>
            <button
              type="button"
              onClick={() => setConditioningExpanded((v) => !v)}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/25 hover:text-white"
              aria-label={conditioningExpanded ? "Collapse conditioning details" : "Expand conditioning details"}
              aria-expanded={conditioningExpanded}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${conditioningExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {conditioningExpanded ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
              <ScoreRow label="Short" score={conditioningShort} tone="conditioning" compact />
              <ScoreRow label="Medium" score={conditioningMedium} tone="conditioning" compact />
              <ScoreRow label="Long" score={conditioningLong} tone="conditioning" compact />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
