"use client";
import clsx from "clsx";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}

/**
 * Sparkline — small trend line. Use for weekly trends in stat cards.
 * Animates draw via `spark-draw`.
 */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  stroke = "currentColor",
  fill,
  className,
}: SparklineProps) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = fill
    ? `${path} L${width.toFixed(1)},${height} L0,${height} Z`
    : null;

  return (
    <svg width={width} height={height} className={clsx("overflow-visible", className)}>
      {area && <path d={area} fill={fill} opacity={0.18} />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="spark-draw" />
    </svg>
  );
}
