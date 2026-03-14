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
  strength: "bg-blue-500",
  conditioning: "bg-emerald-500",
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
        <span className={`${compact ? "font-medium text-slate-700" : "font-semibold text-slate-800"}`}>{label}</span>
        <span className="font-semibold text-slate-900">{score}</span>
      </div>
      <div className={`${compact ? "h-2" : "h-2.5"} w-full rounded-full bg-slate-200`}>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fitness Score</p>
          <h2 className="mt-2 text-4xl font-semibold text-slate-900">{fitnessScore}</h2>
          <p className="mt-1 text-sm text-slate-500">Average of Strength and Conditioning</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <ScoreRow label="Strength Score" score={strengthScore} tone="strength" />
          <div className="grid gap-3 border-l-2 border-slate-200 pl-4">
            <ScoreRow label="Power" score={strengthPower} tone="strength" compact />
            <ScoreRow label="Olympic" score={strengthOlympic} tone="strength" compact />
            <ScoreRow label="Gymnastic" score={strengthGymnastic} tone="strength" compact />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <ScoreRow label="Conditioning Score" score={conditioningScore} tone="conditioning" />
          <div className="grid gap-3 border-l-2 border-slate-200 pl-4">
            <ScoreRow label="Short" score={conditioningShort} tone="conditioning" compact />
            <ScoreRow label="Medium" score={conditioningMedium} tone="conditioning" compact />
            <ScoreRow label="Long" score={conditioningLong} tone="conditioning" compact />
          </div>
        </div>
      </div>
    </section>
  );
}
