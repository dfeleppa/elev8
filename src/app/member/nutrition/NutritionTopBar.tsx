"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

import { isAICoachVisible } from "@/lib/feature-flags";

type Tab = "daily" | "coach" | "ai-coach";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "daily", label: "Daily", href: "/member/nutrition" },
  { id: "coach", label: "Plan", href: "/member/nutrition/coach" },
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

  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let isActive = true;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (isActive && payload?.role) setRole(payload.role);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, []);

  const visibleTabs = TABS.filter((tab) => tab.id !== "ai-coach" || isAICoachVisible(role));

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

      <nav className="flex items-center gap-6 text-[13.5px]">
        {visibleTabs.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={clsx(
                "relative inline-flex items-center py-1 transition",
                isActive
                  ? "font-semibold text-[var(--pink)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              )}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 -bottom-0.5 h-[2px]"
                  style={{ background: "var(--pink)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
