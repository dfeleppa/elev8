"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shiftDate, toLocalDateInputValue } from "./lib";

type DateNavigatorProps = {
  selectedDate: string;
  onChange: (nextDate: string) => void;
};

export default function DateNavigator({ selectedDate, onChange }: DateNavigatorProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
  const todayDate = new Date();
  const todayValue = toLocalDateInputValue(todayDate);
  const compactDateLabel =
    selectedDate === todayValue
      ? `Today, ${selectedDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : selectedDateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          ...(selectedDateObj.getFullYear() !== todayDate.getFullYear() ? { year: "numeric" } : {}),
        });

  return (
    <div className="nutrition-date-pill premium-glass-pill pointer-events-auto mx-auto flex w-full max-w-[calc(100vw-176px)] items-center justify-center p-1.5 shadow-[0_12px_30px_rgba(16,24,40,0.10)] sm:max-w-[330px]">
      <button
        type="button"
        onClick={() => onChange(shiftDate(selectedDate, -1))}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--nutrition-text-muted)] transition hover:bg-[var(--nutrition-surface-solid)] hover:text-[var(--nutrition-text-primary)]"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center px-1">
        <button
          type="button"
          onClick={() => {
            if (dateInputRef.current?.showPicker) {
              dateInputRef.current.showPicker();
              return;
            }
            dateInputRef.current?.click();
          }}
          className="min-w-0 rounded-full px-2 py-2 text-center text-[13px] font-extrabold leading-none text-[var(--nutrition-text-primary)] transition hover:bg-[var(--nutrition-surface-solid)] focus:outline-none focus:ring-2 focus:ring-[var(--nutrition-accent-teal)]/35 min-[380px]:px-3 min-[380px]:text-[14px] sm:text-[15px]"
          aria-label="Open date picker"
        >
          <span className="block truncate">{compactDateLabel}</span>
        </button>
        <input
          ref={dateInputRef}
          id="nutrition-date-mobile"
          name="nutritionDateMobile"
          type="date"
          value={selectedDate}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftDate(selectedDate, 1))}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--nutrition-text-muted)] transition hover:bg-[var(--nutrition-surface-solid)] hover:text-[var(--nutrition-text-primary)]"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
