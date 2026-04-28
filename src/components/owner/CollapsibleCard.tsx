"use client";

import { useState, useEffect, ReactNode } from "react";
import { uiKickerClass, uiSurfaceClass, uiTitleSmClass } from "@/components/ui";

type CollapsibleCardProps = {
  title: string;
  meta?: string;
  defaultCollapsed?: boolean;
  storageKey?: string;
  children: ReactNode;
  className?: string;
};

export default function CollapsibleCard({
  title,
  meta,
  defaultCollapsed = false,
  storageKey,
  children,
  className = "",
}: CollapsibleCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, [storageKey]);

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (storageKey) {
        localStorage.setItem(storageKey, String(next));
      }
      return next;
    });
  };

  return (
    <div className={`${uiSurfaceClass} p-4 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div>
            {meta ? <p className={uiKickerClass}>{meta}</p> : null}
            <h2 className={`mt-1 ${uiTitleSmClass}`}>{title}</h2>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-[var(--text-muted)] transition-transform duration-200 ${
            isCollapsed ? "-rotate-90" : "rotate-0"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100 mt-4"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
