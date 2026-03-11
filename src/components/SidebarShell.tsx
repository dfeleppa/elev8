"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type SidebarShellProps = {
  children: ReactNode;
  mainClassName?: string;
};

type UserRole = "member" | "coach" | "admin" | "owner";

type NavChild = {
  label: string;
  href: string;
  children?: NavChild[];
  minRole?: UserRole;
};

type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
  icon?: ReactNode;
  minRole?: UserRole;
};

const roleRank: Record<UserRole, number> = {
  member: 1,
  coach: 2,
  admin: 3,
  owner: 4,
};

const navItems: NavItem[] = [
  {
    label: "Health",
    href: "/health",
    minRole: "member",
    children: [
      { label: "Training", href: "/health/training" },
      { label: "Weekly", href: "/health/training/weekly" },
    ],
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
  {
    label: "Organization",
    href: "/organization",
    minRole: "member",
    children: [
      {
        label: "Owner",
        href: "/organization/owner",
        minRole: "owner",
        children: [
          { label: "Staff", href: "/organization/owner/staff", minRole: "owner" },
          { label: "Schedule", href: "/organization/owner/schedule", minRole: "owner" },
          { label: "Payroll", href: "/organization/owner/payroll", minRole: "owner" },
          { label: "Billing", href: "/organization/owner/billing", minRole: "owner" },
          { label: "Tracks & Memberships", href: "/organization/owner/tracks-memberships", minRole: "owner" },
          { label: "Integrations", href: "/organization/owner/integrations", minRole: "owner" },
          { label: "Members", href: "/organization/owner/members", minRole: "owner" },
        ],
      },
      {
        label: "Admin",
        href: "/organization/admin",
        minRole: "admin",
        children: [
          { label: "Management", href: "/management", minRole: "admin" },
          { label: "Content", href: "/content", minRole: "admin" },
          { label: "Business Analytics", href: "/organization/admin/analytics", minRole: "admin" },
          { label: "Programming", href: "/organization/admin/programming", minRole: "admin" },
        ],
      },
      {
        label: "Coach",
        href: "/organization/coach",
        minRole: "coach",
        children: [
          { label: "Schedule", href: "/organization/coach/schedule", minRole: "coach" },
          { label: "Reports - Members", href: "/organization/coach/reports-members", minRole: "coach" },
        ],
      },
      {
        label: "Member",
        href: "/organization/member",
        minRole: "member",
        children: [
          { label: "Workout", href: "/organization/member/workout", minRole: "member" },
          { label: "Nutrition", href: "/organization/member/nutrition", minRole: "member" },
          { label: "Class Schedule", href: "/organization/member/class-schedule", minRole: "member" },
          { label: "Account Dashboard", href: "/organization/member/account-dashboard", minRole: "member" },
          { label: "Athlete Dashboard", href: "/organization/member/athlete-dashboard", minRole: "member" },
          { label: "Store", href: "/organization/member/store", minRole: "member" },
        ],
      },
    ],
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M6.5 18c1.8-2.2 4-3.3 5.5-3.3S15.7 15.8 17.5 18"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
        <circle
          cx="12"
          cy="8"
          r="3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
];

export default function SidebarShell({ children, mainClassName }: SidebarShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openSubnav, setOpenSubnav] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<UserRole>("member");
  const pathname = usePathname();
  const mainClasses = mainClassName ??
    "mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1.6fr_1fr] lg:py-16";
  const hamburgerIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload?.role) {
          return;
        }
        if (
          isMounted &&
          (payload.role === "member" ||
            payload.role === "coach" ||
            payload.role === "admin" ||
            payload.role === "owner")
        ) {
          setUserRole(payload.role);
        }
      } catch {
        // Keep the default role for nav filtering.
      }
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  const canViewRole = (requiredRole?: UserRole) => {
    return roleRank[userRole] >= roleRank[requiredRole ?? "member"];
  };

  const visibleNavItems = navItems
    .filter((item) => canViewRole(item.minRole))
    .map((item) => {
      if (!item.children) {
        return item;
      }

      const visibleChildren = item.children
        .filter((child) => canViewRole(child.minRole))
        .map((child) => {
          if (!child.children) {
            return child;
          }
          const visibleGrandchildren = child.children.filter((grandchild) =>
            canViewRole(grandchild.minRole)
          );
          return visibleGrandchildren.length > 0
            ? { ...child, children: visibleGrandchildren }
            : { ...child, children: undefined };
        });

      if (visibleChildren.length === 0) {
        return null;
      }

      return { ...item, children: visibleChildren };
    })
    .filter((item): item is NavItem => Boolean(item));

  return (
    <div className="relative z-10 min-h-screen">
      <div className="lg:hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center gap-3 text-left"
            aria-label="Open menu"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/10">
              <Image
                src="/Elev8rlogo (1).png"
                alt="Elev8"
                width={28}
                height={28}
                className="h-7 w-7"
              />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Elev8</p>
              <p className="text-xs text-slate-500">Control Center</p>
            </div>
          </button>
          <div className="h-8 w-8" aria-hidden="true" />
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
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Image
                    src="/Elev8rlogo (1).png"
                    alt="Elev8"
                    width={28}
                    height={28}
                    className="h-7 w-7"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Elev8</p>
                  <p className="text-xs text-slate-400">Control Center</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                aria-label="Close menu"
              >
                {hamburgerIcon}
              </button>
            </div>

            <nav className="mt-6 space-y-2 text-sm">
              {visibleNavItems.map((item) => {
                const hasActiveChild = item.children?.some((child) =>
                  pathname === child.href ||
                  (child.children?.some((grandchild) => pathname === grandchild.href) ?? false)
                ) ?? false;
                const isActive = pathname === item.href || hasActiveChild;
                return (
                  <div key={item.label} className="space-y-1">
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 font-medium text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-slate-100 ${
                        isActive
                          ? "border-sky-300/40 bg-white/5 text-slate-50 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
                          : ""
                      }`}
                      onClick={() => setMobileSidebarOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span
                        className={`text-slate-400 transition group-hover:text-slate-200 ${
                          isActive ? "text-sky-200" : ""
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                    {item.children && (
                      <div className="ml-10 space-y-1">
                        {item.children.map((child) => {
                          const hasActiveGrandchild = child.children?.some((grandchild) =>
                            pathname === grandchild.href
                          ) ?? false;
                          const isChildActive = pathname === child.href || hasActiveGrandchild;
                          const isExpanded = openSubnav[child.href] ?? hasActiveGrandchild;
                          return (
                            <div key={child.label} className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Link
                                  href={child.href}
                                  className={`flex flex-1 items-center rounded-lg border border-transparent px-3 py-2 text-xs text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-slate-100 ${
                                    isChildActive
                                      ? "border-white/10 bg-white/5 text-slate-50"
                                      : ""
                                  }`}
                                  onClick={() => setMobileSidebarOpen(false)}
                                  aria-current={isChildActive ? "page" : undefined}
                                >
                                  {child.label}
                                </Link>
                                {child.children && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenSubnav((prev) => ({
                                        ...prev,
                                        [child.href]: !(prev[child.href] ?? hasActiveGrandchild),
                                      }))
                                    }
                                    className="rounded-lg border border-transparent p-2 text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-slate-100"
                                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${child.label}`}
                                    aria-expanded={isExpanded}
                                  >
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                                      <path
                                        d={isExpanded ? "M6 14l6-6 6 6" : "M6 10l6 6 6-6"}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="1.7"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              {child.children && isExpanded && (
                                <div className="ml-6 space-y-1">
                                  {child.children.map((grandchild) => {
                                    const isGrandchildActive = pathname === grandchild.href;
                                    return (
                                      <Link
                                        key={grandchild.label}
                                        href={grandchild.href}
                                        className={`flex items-center rounded-lg border border-transparent px-3 py-2 text-[12px] text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-slate-100 ${
                                          isGrandchildActive
                                            ? "border-white/10 bg-white/5 text-slate-50"
                                            : ""
                                        }`}
                                        onClick={() => setMobileSidebarOpen(false)}
                                        aria-current={isGrandchildActive ? "page" : undefined}
                                      >
                                        {grandchild.label}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
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
        className={`card-fade-in fixed inset-y-0 left-0 z-20 hidden border-r border-white/10 bg-slate-950/95 px-3 py-6 backdrop-blur lg:flex lg:flex-col ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
        style={{ animationDelay: "0.05s" }}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <button
            type="button"
            onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
            className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Sidebar logo"}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Image
                src="/Elev8rlogo (1).png"
                alt="Elev8"
                width={28}
                height={28}
                className="h-7 w-7"
              />
            </span>
            <div className={sidebarCollapsed ? "sr-only" : "block"}>
              <p className="text-sm font-semibold text-slate-100">Elev8</p>
              <p className="text-xs text-slate-400">Control Center</p>
            </div>
          </button>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-slate-100"
              aria-label="Collapse sidebar"
            >
              {hamburgerIcon}
            </button>
          )}
        </div>

        <nav className="mt-6 space-y-2 text-sm">
            {visibleNavItems.map((item) => {
            const hasActiveChild = item.children?.some((child) =>
              pathname === child.href ||
              (child.children?.some((grandchild) => pathname === grandchild.href) ?? false)
            ) ?? false;
            const isActive = pathname === item.href || hasActiveChild;
            return (
              <div key={item.label} className="space-y-1">
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 font-medium text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white ${
                    sidebarCollapsed ? "justify-center" : "justify-start"
                  } ${
                    isActive
                      ? "border-rose-200/60 bg-white/10 text-white shadow-[0_0_0_1px_rgba(251,113,133,0.35)]"
                      : ""
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={`text-slate-400 transition group-hover:text-slate-200 ${
                      isActive ? "text-rose-200" : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className={sidebarCollapsed ? "sr-only" : "inline"}>{item.label}</span>
                </Link>
                {item.children && (
                  <div className={`ml-10 space-y-1 ${sidebarCollapsed ? "hidden" : ""}`}>
                    {item.children.map((child) => {
                      const hasActiveGrandchild = child.children?.some((grandchild) =>
                        pathname === grandchild.href
                      ) ?? false;
                      const isChildActive = pathname === child.href || hasActiveGrandchild;
                      const isExpanded = openSubnav[child.href] ?? hasActiveGrandchild;
                      return (
                        <div key={child.label} className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Link
                              href={child.href}
                              className={`flex flex-1 items-center rounded-lg border border-transparent px-3 py-2 text-xs text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-white ${
                                isChildActive
                                  ? "border-white/10 bg-white/5 text-white"
                                  : ""
                              }`}
                              aria-current={isChildActive ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                            {child.children && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSubnav((prev) => ({
                                    ...prev,
                                    [child.href]: !(prev[child.href] ?? hasActiveGrandchild),
                                  }))
                                }
                                className="rounded-lg border border-transparent p-2 text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${child.label}`}
                                aria-expanded={isExpanded}
                              >
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                                  <path
                                    d={isExpanded ? "M6 14l6-6 6 6" : "M6 10l6 6 6-6"}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.7"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                          {child.children && isExpanded && (
                            <div className="ml-6 space-y-1">
                              {child.children.map((grandchild) => {
                                const isGrandchildActive = pathname === grandchild.href;
                                return (
                                  <Link
                                    key={grandchild.label}
                                    href={grandchild.href}
                                    className={`flex items-center rounded-lg border border-transparent px-3 py-2 text-[12px] text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-white ${
                                      isGrandchildActive
                                        ? "border-white/10 bg-white/5 text-white"
                                        : ""
                                    }`}
                                    aria-current={isGrandchildActive ? "page" : undefined}
                                  >
                                    {grandchild.label}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
        className={`theme-soft ${mainClasses} ${
          sidebarCollapsed ? "lg:pl-28" : "lg:pl-72"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
