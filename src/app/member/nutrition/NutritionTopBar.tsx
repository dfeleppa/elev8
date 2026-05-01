"use client";

import Link from "next/link";
import clsx from "clsx";

type Tab = "daily" | "coach";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "daily", label: "Daily", href: "/member/nutrition" },
  { id: "coach", label: "Coach", href: "/member/nutrition-coach" },
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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

      <nav className="flex items-center gap-6 text-[13.5px]">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={clsx(
                "relative inline-flex items-center py-1 transition",
                isActive
                  ? "text-[color:var(--text)] font-semibold"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              )}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 -bottom-0.5 h-[2px]"
                  style={{ background: "var(--text)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
