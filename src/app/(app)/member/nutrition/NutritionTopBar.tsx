"use client";

import Link from "next/link";
import clsx from "clsx";

type Tab = "daily" | "coach" | "ai-coach";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "daily", label: "Daily", href: "/member/nutrition" },
  { id: "coach", label: "Plan", href: "/member/nutrition/coach" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function NutritionTopBar({
  active,
  showDate = true,
}: {
  active: Tab;
  /** Hide the date pill on pages that already display the date themselves. */
  showDate?: boolean;
}) {
  const now = new Date();
  const day = DAY_NAMES[now.getDay()];
  const datePart = `${MONTH_SHORT[now.getMonth()]} ${now.getDate()}`;

  const tabsNav = (
    <nav className="premium-glass-pill flex shrink-0 items-center gap-1 p-1 text-[12px] sm:text-[13.5px]">
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={clsx(
              "relative inline-flex items-center rounded-full px-3 py-1.5 transition sm:px-4 sm:py-2",
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
  );

  if (!showDate) {
    return tabsNav;
  }

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2 lg:w-auto lg:gap-6">
      <div
        className="premium-glass-pill flex min-w-0 items-center gap-1.5 px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] sm:gap-2 sm:px-4 sm:text-[11px]"
        style={{ color: "#475467" }}
      >
        <span className="shrink-0">{day}</span>
        <span style={{ color: "var(--text-soft)" }}>·</span>
        <span className="truncate" style={{ color: "var(--text-soft)" }}>
          {datePart}
        </span>
      </div>

      {tabsNav}
    </div>
  );
}
