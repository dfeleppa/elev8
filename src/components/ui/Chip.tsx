"use client";
import clsx from "clsx";

interface ChipProps {
  children: React.ReactNode;
  tone?: "neutral" | "pink" | "violet" | "lime";
  className?: string;
}

const TONE: Record<NonNullable<ChipProps["tone"]>, string> = {
  neutral: "chip",
  pink: "chip pill-pink",
  violet: "chip pill-violet",
  lime: "chip pill-lime",
};

/**
 * Chip — small status pill.
 * Use for tags, statuses, "live now", muscle groups, food categories, etc.
 */
export function Chip({ children, tone = "neutral", className }: ChipProps) {
  return <span className={clsx(TONE[tone], className)}>{children}</span>;
}
