"use client";
import { ReactNode } from "react";
import clsx from "clsx";
import { Micro } from "./Micro";

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  hint?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Render against an accent card background */
  onAccent?: boolean;
}

const VALUE_SIZE: Record<NonNullable<StatProps["size"]>, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-5xl",
  xl: "text-7xl",
};

/**
 * Stat — labeled metric. Use everywhere a "big number" appears.
 * Replaces dozens of bespoke `<div className="text-5xl font-bold">...</div>` blocks.
 */
export function Stat({
  label,
  value,
  unit,
  delta,
  hint,
  size = "lg",
  className,
  onAccent,
}: StatProps) {
  const arrow = delta ? (delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→") : null;
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <Micro onAccent={onAccent}>{label}</Micro>
      <div className="flex items-baseline gap-2">
        <span
          className={clsx(
            "font-[var(--font-brand-heading)] font-semibold leading-none tracking-tight",
            VALUE_SIZE[size],
          )}
        >
          {value}
        </span>
        {unit && (
          <span className={clsx("text-sm", onAccent ? "opacity-70" : "text-[var(--text-muted)]")}>
            {unit}
          </span>
        )}
      </div>
      {(delta || hint) && (
        <div className={clsx("text-xs", onAccent ? "opacity-70" : "text-[var(--text-muted)]")}>
          {delta && (
            <span className="font-mono mr-2">
              {arrow} {delta.value}
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  );
}
