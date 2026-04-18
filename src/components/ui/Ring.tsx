"use client";
import { ReactNode } from "react";
import clsx from "clsx";

interface RingProps {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Ring — circular progress indicator.
 * Used for calorie ring, hydration ring, workout completion, etc.
 * Animates in via the `arc-anim` class.
 */
export function Ring({
  progress,
  size = 180,
  stroke = 14,
  trackColor = "rgba(255,255,255,0.10)",
  fillColor = "currentColor",
  className,
  children,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <div className={clsx("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={fillColor} strokeWidth={stroke} strokeLinecap="round"
          className="arc-anim"
          style={
            {
              ["--dash" as never]: c,
              ["--offset" as never]: offset,
            } as React.CSSProperties
          }
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
