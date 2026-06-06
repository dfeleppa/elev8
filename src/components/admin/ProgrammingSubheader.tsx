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
    <div className="w-full bg-[#f7f5ef]/80 px-5 py-3">
      <div className="app-subheader-scroll">
        <div className="app-subheader-track justify-center">
          <nav className="premium-glass-pill inline-flex items-center gap-1 p-1 text-[13px]">
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
                  ? "shrink-0 whitespace-nowrap rounded-full bg-[#14D2DC] px-4 py-2 font-semibold text-[#071A1C] shadow-[0_10px_20px_rgba(20,210,220,0.22)] transition-colors"
                  : "shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-medium text-[#667085] transition-colors hover:bg-white/70 hover:text-[#17141F]"
              }
            >
              {tab.label}
            </Link>
          );
        })}
          </nav>
        </div>
      </div>
    </div>
  );
}
