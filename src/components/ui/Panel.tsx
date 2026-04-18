"use client";
import { ReactNode } from "react";
import clsx from "clsx";

interface PanelProps {
  /** Use the slightly darker variant for nested or recessed panels */
  variant?: "default" | "muted";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}

const PADDING: Record<NonNullable<PanelProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

/**
 * Panel — neutral container. Default surface for everything that isn't an AccentCard.
 * Replaces ad-hoc `bg-[#171c22] border border-white/5 rounded-lg` blocks.
 */
export function Panel({ variant = "default", padding = "md", className, children }: PanelProps) {
  return (
    <div
      className={clsx(
        variant === "muted" ? "panel-muted" : "panel",
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
