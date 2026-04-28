import type { ReactNode } from "react";

type OwnerSectionCardProps = {
  title: string;
  meta: string;
  headerRight?: ReactNode;
  headerClassName?: string;
  children: ReactNode;
};

export default function OwnerSectionCard({ title, meta, headerRight, headerClassName, children }: OwnerSectionCardProps) {
  return (
    <section className="ds-surface overflow-hidden p-0">
      <div className={`flex items-center justify-between border-b border-[var(--line)] px-6 py-4 ${headerClassName ?? "bg-[color:color-mix(in_srgb,var(--pink)_12%,transparent)]"}`}>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text)]">{title}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">{meta}</span>
          {headerRight}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
