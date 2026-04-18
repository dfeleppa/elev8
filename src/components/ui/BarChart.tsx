"use client";
import clsx from "clsx";
import { Micro } from "./Micro";

interface BarChartProps {
  data: { label: string; value: number; highlight?: boolean }[];
  /** Optional reference target line */
  target?: number;
  height?: number;
  unit?: string;
  className?: string;
  /** Bar color when not highlighted */
  baseColor?: string;
  /** Bar color when highlighted (today, etc) */
  highlightColor?: string;
}

/**
 * BarChart — minimal weekly bar chart.
 * Used by Nutrition (kcal/day), Workout (volume), Owner (revenue), etc.
 */
export function BarChart({
  data,
  target,
  height = 160,
  unit,
  className,
  baseColor = "var(--panel-2)",
  highlightColor = "var(--pink)",
}: BarChartProps) {
  const max = Math.max(target ?? 0, ...data.map(d => d.value)) * 1.1 || 1;

  return (
    <div className={clsx("relative w-full", className)}>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {target !== undefined && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[var(--line-strong)]"
            style={{ bottom: `${(target / max) * 100}%` }}
          >
            <span className="absolute -top-2 right-0 px-1 bg-[var(--panel)] text-[10px] font-mono text-[var(--text-muted)]">
              {target}{unit}
            </span>
          </div>
        )}
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div
              className="w-full rounded-t-sm bar-grow"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: d.highlight ? highlightColor : baseColor,
                animationDelay: `${i * 50}ms`,
              }}
              title={`${d.value}${unit ?? ""}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d, i) => (
          <Micro key={i} className="flex-1 text-center !text-[9px]">{d.label}</Micro>
        ))}
      </div>
    </div>
  );
}
