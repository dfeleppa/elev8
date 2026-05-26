"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import clsx from "clsx";

export type DashboardTone = "teal" | "pink" | "ink" | "violet";

const toneStyles: Record<DashboardTone, { accent: string; soft: string; text: string; button: string }> = {
  teal: {
    accent: "bg-[#14D2DC]",
    soft: "bg-[rgba(20,210,220,0.1)] border-[rgba(20,210,220,0.22)]",
    text: "text-[#0D98A1]",
    button: "bg-[#14D2DC] text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.22)] hover:brightness-105",
  },
  pink: {
    accent: "bg-[#FF5CA8]",
    soft: "bg-[rgba(255,92,168,0.1)] border-[rgba(255,92,168,0.22)]",
    text: "text-[#B42368]",
    button: "bg-[#FF5CA8] text-white shadow-[0_14px_30px_rgba(255,92,168,0.2)] hover:brightness-105",
  },
  ink: {
    accent: "bg-[#17141F]",
    soft: "bg-[rgba(23,20,31,0.06)] border-[rgba(16,24,40,0.1)]",
    text: "text-[#17141F]",
    button: "bg-[#17141F] text-white shadow-[0_14px_30px_rgba(16,24,40,0.18)] hover:bg-[#101828]",
  },
  violet: {
    accent: "bg-[#6D3DD4]",
    soft: "bg-[rgba(109,61,212,0.09)] border-[rgba(109,61,212,0.18)]",
    text: "text-[#5A2FCC]",
    button: "bg-[#6D3DD4] text-white shadow-[0_14px_30px_rgba(109,61,212,0.18)] hover:brightness-105",
  },
};

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "premium-main-glow min-h-[calc(100vh-3.5rem)] w-full px-5 py-4 text-[#17141F] sm:px-8 lg:px-10 lg:py-6 2xl:px-12",
        className,
      )}
    >
      <div className="flex w-full max-w-[1800px] flex-col gap-5">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div>
        <h1 className="font-head text-[28px] font-bold leading-tight tracking-normal text-[#17141F] sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-[15px] font-medium leading-6 text-[#475467]">{subtitle}</p>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function SubNavTabs<T extends string>({
  tabs,
  active,
  onChange,
  tone = "teal",
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  tone?: DashboardTone;
}) {
  const toneClass = toneStyles[tone];
  return (
    <nav className="premium-glass-pill overflow-x-auto p-1.5 scrollbar-none" aria-label="Athlete dashboard sections">
      <div className="flex min-w-max items-center gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={clsx(
                "shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition",
                isActive
                  ? clsx(toneClass.button, "shadow-none")
                  : "text-[#667085] hover:bg-white/60 hover:text-[#17141F]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function GlassCard({
  children,
  className,
  padding = "lg",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-5 sm:p-6",
  }[padding];

  return <div className={clsx("premium-glass-card", paddingClass, className)}>{children}</div>;
}

export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("grid w-full gap-5", className)}>{children}</div>;
}

export function MetricRow({
  label,
  value,
  unit,
  detail,
  action,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/66 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#17141F]">{label}</p>
        {detail ? <p className="mt-0.5 text-xs font-medium text-[#667085]">{detail}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right">
        <span className="text-sm font-bold text-[#17141F]">{value}</span>
        {unit ? <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#667085]">{unit}</span> : null}
        {action}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
  tone = "teal",
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  tone?: DashboardTone;
  icon?: ReactNode;
  className?: string;
}) {
  const toneClass = toneStyles[tone];
  return (
    <GlassCard className={clsx("relative overflow-hidden", className)} padding="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-head text-4xl font-bold leading-none text-[#17141F]">{value}</span>
            {unit ? <span className="text-sm font-bold text-[#667085]">{unit}</span> : null}
          </div>
          {hint ? <p className="mt-2 text-sm font-medium leading-5 text-[#667085]">{hint}</p> : null}
        </div>
        {icon ? (
          <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", toneClass.soft, toneClass.text)}>
            {icon}
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}

export function ProgressRow({
  label,
  value,
  tone = "teal",
}: {
  label: ReactNode;
  value: number;
  tone?: DashboardTone;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass = toneStyles[tone];
  return (
    <div className="rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/66 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#17141F]">{label}</span>
        <span className={clsx("text-sm font-bold", toneClass.text)}>{clamped}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(16,24,40,0.08)]">
        <div className={clsx("h-full rounded-full transition-all", toneClass.accent)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "danger";
  tone?: DashboardTone;
};

export function ActionButton({ className, variant = "primary", tone = "teal", children, ...props }: ButtonProps) {
  const toneClass = toneStyles[tone];
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && toneClass.button,
        variant === "secondary" &&
          "border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#17141F] hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)]",
        variant === "danger" && "bg-rose-600 text-white shadow-[0_14px_30px_rgba(225,29,72,0.2)] hover:bg-rose-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ActionLink({
  className,
  variant = "secondary",
  tone = "teal",
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
  tone?: DashboardTone;
}) {
  const toneClass = toneStyles[tone];
  return (
    <Link
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
        variant === "primary" && toneClass.button,
        variant === "secondary" &&
          "border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#17141F] hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[rgba(16,24,40,0.12)] bg-white/54 p-8 text-center">
      <h3 className="text-lg font-bold text-[#17141F]">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#667085]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
