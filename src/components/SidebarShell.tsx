"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Dumbbell,
  FileText,
  HandPlatter,
  PlugZap,
  ShieldCheck,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

type SidebarShellProps = {
  children: ReactNode;
  mainClassName?: string;
};

type UserRole = "member" | "coach" | "admin" | "owner";

type NavChild = {
  label: string;
  href: string;
  icon?: ReactNode;
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
    label: "Organization",
    href: "/organization",
    minRole: "member",
    children: [
      {
        label: "Owner",
        href: "/organization/owner",
        minRole: "owner",
        children: [
          { label: "Agents", href: "/organization/owner/agents", minRole: "owner" },
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
          { label: "Athlete Dashboard", href: "/organization/member/athlete-dashboard", minRole: "member" },
          { label: "Workout", href: "/organization/member/workout", minRole: "member" },
          { label: "Nutrition", href: "/organization/member/nutrition", minRole: "member" },
          { label: "Class Schedule", href: "/organization/member/class-schedule", minRole: "member" },
          { label: "Account Dashboard", href: "/organization/member/account-dashboard", minRole: "member" },
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

function getNavIcon(href: string) {
  const iconClass = "h-[18px] w-[18px]";
  const iconProps = {
    className: iconClass,
    strokeWidth: 1.9,
    "aria-hidden": true as const,
  };

  switch (href) {
    case "/organization/owner/agents":
      return <Bot {...iconProps} />;
    case "/organization/owner/staff":
    case "/organization/owner/members":
    case "/organization/members":
      return <Users {...iconProps} />;
    case "/organization/owner/schedule":
    case "/organization/coach/schedule":
    case "/organization/member/class-schedule":
      return <CalendarDays {...iconProps} />;
    case "/organization/owner/payroll":
    case "/organization/owner/billing":
    case "/organization/member/store":
      return <Wallet {...iconProps} />;
    case "/organization/owner/tracks-memberships":
      return <ShieldCheck {...iconProps} />;
    case "/organization/owner/integrations":
      return <PlugZap {...iconProps} />;
    case "/management":
      return <Briefcase {...iconProps} />;
    case "/content":
      return <FileText {...iconProps} />;
    case "/organization/admin/analytics":
      return <BarChart3 {...iconProps} />;
    case "/organization/admin/programming":
    case "/organization/member/workout":
      return <Dumbbell {...iconProps} />;
    case "/organization/coach/reports-members":
      return <ClipboardList {...iconProps} />;
    case "/organization/member/athlete-dashboard":
      return <Activity {...iconProps} />;
    case "/organization/member/nutrition":
      return <HandPlatter {...iconProps} />;
    case "/organization/member/account-dashboard":
      return <UserCircle2 {...iconProps} />;
    default:
      return <CircleDot {...iconProps} />;
  }
}

export default function SidebarShell({ children, mainClassName }: SidebarShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("member");
  const [userName, setUserName] = useState("User");
  const [organizationName, setOrganizationName] = useState("Organization");
  const [currentTrack, setCurrentTrack] = useState("Main");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isImportingResults, setIsImportingResults] = useState(false);
  const [topBarNotice, setTopBarNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
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
        if (isMounted && typeof payload.userName === "string" && payload.userName.trim()) {
          setUserName(payload.userName.trim());
        }
        if (isMounted && typeof payload.organizationName === "string" && payload.organizationName.trim()) {
          setOrganizationName(payload.organizationName.trim());
        }
        if (isMounted && typeof payload.currentTrack === "string" && payload.currentTrack.trim()) {
          setCurrentTrack(payload.currentTrack.trim());
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

  const handleImportSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsImportingResults(true);
      setTopBarNotice(null);
      const csvText = await file.text();

      const response = await fetch("/api/programming/results/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const payload = (await response.json()) as {
        error?: string;
        inserted?: number;
        totalRows?: number;
        failures?: number;
        trackName?: string;
      };

      if (!response.ok) {
        setTopBarNotice(payload.error ?? "Import failed.");
        return;
      }

      if (payload.trackName) {
        setCurrentTrack(payload.trackName);
      }

      const inserted = payload.inserted ?? 0;
      const totalRows = payload.totalRows ?? 0;
      const failures = payload.failures ?? 0;
      setTopBarNotice(
        failures > 0
          ? `Imported ${inserted}/${totalRows} results (${failures} failed).`
          : `Imported ${inserted}/${totalRows} workout results.`
      );
    } catch {
      setTopBarNotice("Import failed.");
    } finally {
      setIsImportingResults(false);
      event.target.value = "";
    }
  };

  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

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

  const sectionGroups = visibleNavItems.flatMap((item) => item.children ?? []).filter((section) =>
    Array.isArray(section.children) && section.children.length > 0
  );
  const collapsedEntries = sectionGroups.flatMap((section) => section.children ?? []);

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

            <nav className="mt-6 space-y-5 text-sm">
              {sectionGroups.map((section) => (
                <div key={section.label} className="space-y-2">
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
                  <div className="space-y-1">
                    {section.children?.map((entry) => {
                      const isActive = pathname === entry.href;
                      return (
                        <Link
                          key={entry.label}
                          href={entry.href}
                          className={`flex items-center rounded-lg border border-transparent px-3 py-2 text-xs text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-slate-100 ${
                            isActive ? "border-white/10 bg-white/5 text-slate-50" : ""
                          }`}
                          onClick={() => setMobileSidebarOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="mr-2 text-slate-400">{getNavIcon(entry.href)}</span>
                          {entry.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
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
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-slate-100"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {hamburgerIcon}
          </button>
        </div>

        {sidebarCollapsed ? (
          <nav className="mt-6 flex flex-1 flex-col items-center gap-2 overflow-y-auto">
            {collapsedEntries.map((entry) => {
              const isActive = pathname === entry.href;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`group flex h-10 w-10 items-center justify-center rounded-xl border text-slate-300 transition ${
                    isActive
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-transparent hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                  aria-label={entry.label}
                  title={entry.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  {getNavIcon(entry.href)}
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="mt-6 space-y-5 text-sm">
            {sectionGroups.map((section) => (
              <div key={section.label} className="space-y-2">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
                <div className="space-y-1">
                  {section.children?.map((entry) => {
                    const isActive = pathname === entry.href;
                    return (
                      <Link
                        key={entry.label}
                        href={entry.href}
                        className={`flex items-center rounded-lg border border-transparent px-3 py-2 text-xs text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-white ${
                          isActive ? "border-white/10 bg-white/5 text-white" : ""
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="mr-2 text-slate-400">{getNavIcon(entry.href)}</span>
                        {entry.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        )}
      </aside>

      <div className={`${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="hidden h-14 w-full items-center justify-between bg-[#2fa8e8] px-5 text-white lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{organizationName}</p>
            <p className="truncate text-xs text-sky-100">Current Track: {currentTrack}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sky-50 transition hover:text-white"
              aria-label="TV display mode"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M4 5h16v11H4z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M10 19h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
              </svg>
              TV Display Mode
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 text-sky-50 transition hover:text-white"
              aria-label="User account"
            >
              <span className="truncate max-w-[160px]">{userName}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                {userInitial}
              </span>
            </button>

            <Link
              href="/content"
              className="inline-flex items-center text-sky-50 transition hover:text-white"
              aria-label="Messenger"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M4 6h16v10H8l-4 3z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
              </svg>
            </Link>

            <button
              type="button"
              className="inline-flex items-center text-sky-50 transition hover:text-white"
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M12 4a4 4 0 0 0-4 4v2.5c0 1.8-.7 3.5-2 4.7h12c-1.3-1.2-2-2.9-2-4.7V8a4 4 0 0 0-4-4z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                <path d="M10 18a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
              </svg>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center text-sky-50 transition hover:text-white"
                aria-label="More options"
                aria-expanded={menuOpen}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      importInputRef.current?.click();
                    }}
                    disabled={isImportingResults}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    {isImportingResults ? "Importing workout results..." : "Import Workout Results (CSV)"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleImportSelection}
          className="hidden"
        />

        {topBarNotice ? (
          <div className="hidden border-b border-sky-200 bg-sky-50 px-5 py-2 text-sm text-sky-900 lg:block">
            {topBarNotice}
          </div>
        ) : null}

        <main className={`theme-soft ${mainClasses}`}>{children}</main>
      </div>
    </div>
  );
}
