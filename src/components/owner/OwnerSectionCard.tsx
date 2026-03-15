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
    <section className="glass-panel app-card overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-0">
      <div className={`flex items-center justify-between px-6 py-4 ${headerClassName ?? "bg-[#e11d8a]"}`}>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">{title}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/80">{meta}</span>
          {headerRight}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
