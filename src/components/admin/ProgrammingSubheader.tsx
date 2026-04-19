"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Programming", href: "/admin/programming" },
  { label: "Builder", href: "/admin/programming/builder" },
];

export default function ProgrammingSubheader() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent px-5 py-2">
      <div className="app-subheader-scroll">
        <div className="app-subheader-track">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/admin/programming"
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                isActive
                  ? "shrink-0 whitespace-nowrap rounded-xl border border-indigo-400/30 bg-indigo-400/15 px-4 py-2 text-sm font-semibold text-indigo-300 transition-colors"
                  : "shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
              }
            >
              {tab.label}
            </Link>
          );
        })}
        </div>
      </div>
    </div>
  );
}
