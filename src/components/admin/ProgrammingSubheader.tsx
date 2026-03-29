"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Programming", href: "/organization/admin/programming" },
  { label: "Builder", href: "/organization/admin/programming/builder" },
];

export default function ProgrammingSubheader() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent px-5 py-2">
      <div className="flex gap-1 flex-wrap">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/organization/admin/programming"
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                isActive
                  ? "rounded-xl border border-indigo-400/30 bg-indigo-400/15 px-4 py-2 text-sm font-semibold text-indigo-300 transition-colors"
                  : "rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
