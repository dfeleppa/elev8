"use client";

import Link from "next/link";
import clsx from "clsx";

type Tab = "daily" | "coach" | "ai-coach";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "daily", label: "Daily", href: "/member/nutrition" },
  { id: "coach", label: "Plan", href: "/member/nutrition/coach" },
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
        className="premium-glass-pill flex items-center gap-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "#475467" }}
      >
        <span>{day}</span>
        <span style={{ color: "var(--text-soft)" }}>·</span>
        <span style={{ color: "var(--text-soft)" }}>{datePart}</span>
        <span style={{ color: "var(--text-soft)" }}>·</span>
        <span style={{ color: "var(--text-soft)" }}>Week {week}</span>
      </div>

      <nav className="premium-glass-pill flex items-center gap-1 p-1 text-[13.5px]">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={clsx(
                "relative inline-flex items-center rounded-full px-4 py-2 transition",
                isActive
                  ? "bg-[#14D2DC] font-semibold text-[#071A1C] shadow-[0_10px_20px_rgba(20,210,220,0.22)]"
                  : "text-[#667085] hover:bg-white/70 hover:text-[#17141F]",
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
