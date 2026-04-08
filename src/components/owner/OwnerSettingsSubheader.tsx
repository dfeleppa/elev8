"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Agents", href: "/organization/owner/agents" },
  { label: "Store Setup", href: "/organization/owner/store-setup" },
  { label: "Integrations", href: "/organization/owner/integrations" },
  { label: "General Settings", href: "/organization/owner/settings" },
];

export default function OwnerSettingsSubheader() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b border-white/10 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent px-5 py-2">
      <div className="app-subheader-scroll">
        <div className="app-subheader-track">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                isActive
                  ? "shrink-0 whitespace-nowrap rounded-xl border border-[#ffb1c4]/30 bg-[#ffb1c4]/15 px-4 py-2 text-sm font-semibold text-[#ffb1c4] transition-colors"
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
