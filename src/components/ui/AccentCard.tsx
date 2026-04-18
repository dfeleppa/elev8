"use client";
import { ReactNode } from "react";
import clsx from "clsx";

export type AccentTone = "pink" | "violet" | "lime" | "ink";

interface AccentCardProps {
  tone?: AccentTone;
  className?: string;
  children: ReactNode;
  withDots?: boolean;
  /** Render with subtle hover lift (default true) */
  interactive?: boolean;
}

const TONE_CLASS: Record<AccentTone, string> = {
  pink: "accent-pink",
  violet: "accent-violet",
  lime: "accent-lime",
  ink: "accent-ink",
};

/**
 * AccentCard — vivid hero/insight panel.
 * Use sparingly: at most 2-3 per screen (one hero, one insight).
 * Text color is baked in for contrast — don't override unless you know what you're doing.
 */
export function AccentCard({
  tone = "pink",
  className,
  children,
  withDots = true,
  interactive = true,
}: AccentCardProps) {
  return (
    <div
      className={clsx(
        TONE_CLASS[tone],
        "relative overflow-hidden rounded-[10px] p-6",
        withDots && "dotgrid",
        interactive && "hover-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}
