"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GlassCard, ProgressRow } from "@/components/member-dashboard/PremiumDashboard";

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
  compact?: boolean;
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ScoreRow({ label, score, compact = false }: ScoreRowProps) {
  return (
    <ProgressRow label={label} value={score} tone={compact ? "teal" : "pink"} />
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
    <GlassCard className="relative flex min-h-[430px] flex-col overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[rgba(255,92,168,0.16)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 left-10 h-36 w-36 rounded-full bg-[rgba(20,210,220,0.12)] blur-3xl" />

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Fitness Score</p>
        <div className="mt-2 flex items-end gap-2">
          <span className="font-head text-7xl font-bold leading-none tracking-normal text-[#17141F]">
            {fitnessScore}
          </span>
          <span className="mb-2 text-lg font-bold text-[#667085]">/100</span>
        </div>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-[#667085]">
          Average of strength and conditioning markers.
        </p>
      </div>

      <div className="relative mt-6 grid flex-1 gap-3">
        <div className="rounded-[22px] border border-[rgba(16,24,40,0.08)] bg-white/58 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ScoreRow label="Strength Score" score={strengthScore} />
            </div>
            <button
              type="button"
              onClick={() => setStrengthExpanded((v) => !v)}
              className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#667085] transition hover:text-[#17141F]"
              aria-label={strengthExpanded ? "Collapse strength details" : "Expand strength details"}
              aria-expanded={strengthExpanded}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${strengthExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
          {strengthExpanded && (
            <div className="mt-4 grid gap-3 border-t border-[rgba(16,24,40,0.08)] pt-4">
              <ScoreRow label="Power" score={strengthPower} compact />
              <ScoreRow label="Olympic" score={strengthOlympic} compact />
              <ScoreRow label="Gymnastic" score={strengthGymnastic} compact />
            </div>
          )}
        </div>

        <div className="rounded-[22px] border border-[rgba(16,24,40,0.08)] bg-white/58 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ScoreRow label="Conditioning Score" score={conditioningScore} />
            </div>
            <button
              type="button"
              onClick={() => setConditioningExpanded((v) => !v)}
              className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#667085] transition hover:text-[#17141F]"
              aria-label={conditioningExpanded ? "Collapse conditioning details" : "Expand conditioning details"}
              aria-expanded={conditioningExpanded}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${conditioningExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
          {conditioningExpanded && (
            <div className="mt-4 grid gap-3 border-t border-[rgba(16,24,40,0.08)] pt-4">
              <ScoreRow label="Short" score={conditioningShort} compact />
              <ScoreRow label="Medium" score={conditioningMedium} compact />
              <ScoreRow label="Long" score={conditioningLong} compact />
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
