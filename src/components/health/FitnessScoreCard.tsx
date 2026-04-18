"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AccentCard, Micro, Stat } from "@/components/ui";

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
    <div className="space-y-2">
      <div className={`flex items-center justify-between ${compact ? "text-xs" : "text-sm"}`}>
        <span className={`${compact ? "font-medium opacity-80" : "font-semibold opacity-90"}`}>{label}</span>
        <span className="font-semibold">{score}</span>
      </div>
      <div className={`${compact ? "h-2" : "h-2.5"} w-full rounded-full bg-black/15`}>
        <div
          className="h-full rounded-full bg-black/40 transition-all"
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
    <AccentCard tone="pink">
      <Micro onAccent as="p">Fitness Score</Micro>
      <Stat label="" value={fitnessScore} unit="/100" size="xl" onAccent className="mt-2" />
      <p className="mt-1 text-sm opacity-60">Average of Strength and Conditioning</p>

      <div className="mt-6 grid gap-3">
        <div className="rounded-xl border border-black/10 bg-black/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ScoreRow label="Strength Score" score={strengthScore} />
            </div>
            <button
              type="button"
              onClick={() => setStrengthExpanded((v) => !v)}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/10 opacity-70 transition hover:opacity-100"
              aria-label={strengthExpanded ? "Collapse strength details" : "Expand strength details"}
              aria-expanded={strengthExpanded}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${strengthExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
          {strengthExpanded && (
            <div className="mt-4 grid gap-3 border-t border-black/10 pt-4">
              <ScoreRow label="Power" score={strengthPower} compact />
              <ScoreRow label="Olympic" score={strengthOlympic} compact />
              <ScoreRow label="Gymnastic" score={strengthGymnastic} compact />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-black/10 bg-black/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ScoreRow label="Conditioning Score" score={conditioningScore} />
            </div>
            <button
              type="button"
              onClick={() => setConditioningExpanded((v) => !v)}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/10 opacity-70 transition hover:opacity-100"
              aria-label={conditioningExpanded ? "Collapse conditioning details" : "Expand conditioning details"}
              aria-expanded={conditioningExpanded}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${conditioningExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
          {conditioningExpanded && (
            <div className="mt-4 grid gap-3 border-t border-black/10 pt-4">
              <ScoreRow label="Short" score={conditioningShort} compact />
              <ScoreRow label="Medium" score={conditioningMedium} compact />
              <ScoreRow label="Long" score={conditioningLong} compact />
            </div>
          )}
        </div>
      </div>
    </AccentCard>
  );
}
