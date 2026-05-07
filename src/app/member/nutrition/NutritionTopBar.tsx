"use client";

import Link from "next/link";
import clsx from "clsx";

type Tab = "daily" | "coach" | "ai-coach";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "daily", label: "Daily", href: "/member/nutrition" },
  { id: "coach", label: "Coach", href: "/member/nutrition/coach" },
  { id: "ai-coach", label: "AI Coach", href: "/member/nutrition-coach" },
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isoWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export default function NutritionTopBar({ active }: { active: Tab }) {
  const now = new Date();
  const day = DAY_NAMES[now.getDay()];
  const datePart = `${now.getDate()} ${MONTH_SHORT[now.getMonth()]} ${now.getFullYear()}`;
  const week = isoWeek(now);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        <span>{day}</span>
        <span style={{ color: "var(--text-soft)" }}>·</span>
        <span style={{ color: "var(--text-soft)" }}>{datePart}</span>
        <span style={{ color: "var(--text-soft)" }}>·</span>
        <span style={{ color: "var(--text-soft)" }}>Week {week}</span>
      </div>

      <nav className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={clsx(
                "shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-colors",
                isActive
                  ? "border border-[var(--pink)]/30 bg-[var(--pink)]/12 font-semibold text-[var(--pink)]"
                  : "border border-[var(--line-strong)] bg-[var(--panel-2)] font-medium text-[var(--text-muted)] hover:border-[var(--pink)]/30 hover:text-[var(--text)]",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
