"use client";
import { ReactNode } from "react";
import clsx from "clsx";

interface MicroProps {
  children: ReactNode;
  className?: string;
  /** Use a darker tint over accent cards */
  onAccent?: boolean;
  as?: "span" | "div" | "p";
}

/**
 * Micro — uppercase mono label.
 * The single typography pattern used for section headers, card titles, axis labels, etc.
 * Replaces every `text-[10px] uppercase tracking-[0.14em] font-mono text-white/50` you see today.
 */
export function Micro({ children, className, onAccent, as: Tag = "span" }: MicroProps) {
  return (
    <Tag
      className={clsx(
        "micro",
        onAccent && "!text-current/70",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
