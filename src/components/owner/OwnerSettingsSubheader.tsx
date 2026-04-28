"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { uiTabActiveClass, uiTabClass } from "@/components/ui";

const TABS = [
  { label: "Agents", href: "/owner/agents" },
  { label: "Store Setup", href: "/owner/store-setup" },
  { label: "Integrations", href: "/owner/integrations" },
  { label: "General Settings", href: "/owner/settings" },
];

export default function OwnerSettingsSubheader() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--pink)_8%,transparent)] px-5 py-2">
      <div className="app-subheader-scroll">
        <div className="app-subheader-track">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${isActive ? uiTabActiveClass : uiTabClass} shrink-0 whitespace-nowrap`}
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
