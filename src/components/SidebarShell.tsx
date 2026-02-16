"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type SidebarShellProps = {
  children: ReactNode;
  mainClassName?: string;
};

const navItems = [
  {
    label: "Management",
    href: "/management",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M4 7h10M4 12h16M4 17h10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
  {
    label: "Content",
    href: "/content",
    children: [
      { label: "YouTube", href: "/content/youtube" },
      { label: "X", href: "/content/x" },
      { label: "Meta", href: "/content/meta" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M6 6h12M6 10h12M6 14h8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    label: "Health",
    href: "/health",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 20s-6-4.2-8-7.8C2.6 9.4 4 7 6.8 7c1.8 0 3.2 1 4 2.4C11.6 8 13 7 14.8 7 17.6 7 19 9.4 20 12.2 18 15.8 12 20 12 20z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
        <path
          d="M8.5 12h2l1.3 2.4 1.7-4.2 1.2 1.8h2.8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      </svg>
    ),
  },
];

export default function SidebarShell({ children, mainClassName }: SidebarShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const mainClasses = mainClassName ??
    "mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1.6fr_1fr] lg:py-16";

  return (
    <div className="relative z-10 min-h-screen">
      <div className="lg:hidden">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-slate-100">
              E8
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-100">Elev8</p>
              <p className="text-xs text-slate-400">Control Center</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300 transition hover:border-white/30 hover:text-slate-100"
            aria-label="Open menu"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-slate-950/95 px-3 py-6 backdrop-blur">
            <div className="flex items-center justify-between gap-2 px-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-slate-100">
                  E8
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Elev8</p>
                  <p className="text-xs text-slate-400">Control Center</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                aria-label="Close menu"
              >
                Close
              </button>
            </div>

            <nav className="mt-6 space-y-1 text-sm">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.children?.some((child) => pathname === child.href) ?? false);
                return (
                  <div key={item.label} className="space-y-1">
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-200 transition hover:bg-white/10 ${
                        isActive ? "bg-white/10 text-slate-50" : ""
                      }`}
                      onClick={() => setMobileSidebarOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="text-slate-300">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                    {item.children && (
                      <div className="ml-10 space-y-1">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <Link
                              key={child.label}
                              href={child.href}
                              className={`flex items-center rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10 ${
                                isChildActive ? "bg-white/10 text-slate-50" : ""
                              }`}
                              onClick={() => setMobileSidebarOpen(false)}
                              aria-current={isChildActive ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <aside
        className={`card-fade-in fixed inset-y-0 left-0 z-20 hidden border-r border-white/10 bg-slate-950/80 px-3 py-6 backdrop-blur lg:flex lg:flex-col ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
        style={{ animationDelay: "0.05s" }}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-slate-100">
              E8
            </span>
            <div className={sidebarCollapsed ? "sr-only" : "block"}>
              <p className="text-sm font-semibold text-slate-100">Elev8</p>
              <p className="text-xs text-slate-400">Control Center</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300 transition hover:border-white/30 hover:text-slate-100"
            aria-pressed={sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <nav className="mt-6 space-y-1 text-sm">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.children?.some((child) => pathname === child.href) ?? false);
            return (
              <div key={item.label} className="space-y-1">
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-200 transition hover:bg-white/10 ${
                    sidebarCollapsed ? "justify-center" : "justify-start"
                  } ${
                    isActive ? "bg-white/10 text-slate-50" : ""
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="text-slate-300">{item.icon}</span>
                  <span className={sidebarCollapsed ? "sr-only" : "inline"}>{item.label}</span>
                </Link>
                {item.children && (
                  <div className={`ml-10 space-y-1 ${sidebarCollapsed ? "hidden" : ""}`}>
                    {item.children.map((child) => {
                      const isChildActive = pathname === child.href;
                      return (
                        <Link
                          key={child.label}
                          href={child.href}
                          className={`flex items-center rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10 ${
                            isChildActive ? "bg-white/10 text-slate-50" : ""
                          }`}
                          aria-current={isChildActive ? "page" : undefined}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main
        className={`${mainClasses} ${
          sidebarCollapsed ? "lg:pl-28" : "lg:pl-72"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
