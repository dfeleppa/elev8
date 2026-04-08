"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut,
  PersonStanding,
  PlugZap,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

type SidebarShellProps = {
  children: ReactNode;
  mainClassName?: string;
};

type UserRole = "member" | "coach" | "admin" | "owner";
type ViewMode = "gym" | "athlete";

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
        label: "Coach",
        href: "/organization/coach",
        minRole: "coach",
        children: [
          { label: "Gym Dashboard", href: "/organization/gym-dashboard", minRole: "coach" },
          { label: "Reports - Members", href: "/organization/coach/reports-members", minRole: "coach" },
        ],
      },
      {
        label: "Owner",
        href: "/organization/owner",
        minRole: "owner",
        children: [
          { label: "Staff", href: "/organization/owner/staff", minRole: "owner" },
          { label: "Class Setup", href: "/organization/owner/schedule", minRole: "owner" },
          { label: "Payroll", href: "/organization/owner/payroll", minRole: "owner" },
          { label: "Billing", href: "/organization/owner/billing", minRole: "owner" },
          { label: "Tracks & Memberships", href: "/organization/owner/tracks-memberships", minRole: "owner" },
          { label: "Members", href: "/organization/owner/members", minRole: "owner" },
          { label: "Organization Settings", href: "/organization/owner/settings", minRole: "owner" },
        ],
      },
      {
        label: "Admin",
        href: "/organization/admin",
        minRole: "admin",
        children: [
          { label: "Management", href: "/management", minRole: "admin" },
          { label: "Content", href: "/organization/admin/content", minRole: "admin" },
          { label: "Business Analytics", href: "/organization/admin/analytics", minRole: "admin" },
          { label: "Programming", href: "/organization/admin/programming", minRole: "admin" },
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

const mobileQuickLinks = [
  { label: "Workout", href: "/organization/member/workout", icon: <Dumbbell className="h-4 w-4" aria-hidden="true" /> },
  { label: "Nutrition", href: "/organization/member/nutrition", icon: <HandPlatter className="h-4 w-4" aria-hidden="true" /> },
  { label: "Classes", href: "/organization/member/class-schedule", icon: <CalendarDays className="h-4 w-4" aria-hidden="true" /> },
] as const;

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
    case "/organization/member/class-schedule":
      return <CalendarDays {...iconProps} />;
    case "/organization/owner/payroll":
    case "/organization/owner/billing":
      return <Wallet {...iconProps} />;
    case "/organization/owner/store-setup":
    case "/organization/member/store":
      return <ShoppingBag {...iconProps} />;
    case "/organization/owner/tracks-memberships":
      return <ShieldCheck {...iconProps} />;
    case "/organization/owner/integrations":
      return <PlugZap {...iconProps} />;
    case "/organization/owner/settings":
      return <Settings {...iconProps} />;
    case "/management":
      return <Briefcase {...iconProps} />;
    case "/organization/gym-dashboard":
      return <BarChart3 {...iconProps} />;
    case "/organization/admin/content":
      return <FileText {...iconProps} />;
    case "/organization/admin/analytics":
      return <BarChart3 {...iconProps} />;
    case "/organization/admin/programming":
    case "/organization/admin/programming/builder":
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
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [viewMode, setViewMode] = useState<ViewMode>("gym");
  const [userRole, setUserRole] = useState<UserRole>("member");
  const [userName, setUserName] = useState("User");
  const [organizationName, setOrganizationName] = useState("Organization");
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState("Main");
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isImportingResults, setIsImportingResults] = useState(false);
  const [topBarNotice, setTopBarNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
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
  const canAccessGymView = roleRank[userRole] >= roleRank.coach;
  const showViewToggle = canAccessGymView;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem("elev8-theme");
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    const storedMode = typeof window !== "undefined" ? window.localStorage.getItem("sidebar-view-mode") : null;
    if (storedMode === "gym" || storedMode === "athlete") {
      if (storedMode === "gym" && !canAccessGymView) {
        setViewMode("athlete");
        if (typeof window !== "undefined") {
          window.localStorage.setItem("sidebar-view-mode", "athlete");
        }
        return;
      }

      setViewMode(storedMode);
      return;
    }

    if (!canAccessGymView || pathname?.startsWith("/organization/member")) {
      setViewMode("athlete");
    } else {
      setViewMode("gym");
    }
  }, [canAccessGymView, pathname]);

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
        if (isMounted) {
          setOrganizationLogoUrl(
            typeof payload.organizationLogoUrl === "string" && payload.organizationLogoUrl.trim()
              ? payload.organizationLogoUrl.trim()
              : null
          );
        }
        if (isMounted && typeof payload.currentTrack === "string" && payload.currentTrack.trim()) {
          setCurrentTrack(payload.currentTrack.trim());
        }

        const orgId =
          Array.isArray(payload.organizationIds) && payload.organizationIds.length > 0
            ? payload.organizationIds[0]
            : null;

        if (orgId && isMounted) {
          try {
            const tr = await fetch(`/api/programming/tracks?organizationId=${orgId}`, { cache: "no-store" });
            const tp = await tr.json();
            const fetchedTracks: { id: string; name: string }[] = (tp?.tracks ?? []).map(
              (t: { id: string; name: string }) => ({ id: t.id, name: t.name })
            );
            if (isMounted) {
              setTracks(fetchedTracks);
              const storedId = typeof window !== "undefined" ? localStorage.getItem("elev8-track-id") : null;
              if (storedId && fetchedTracks.some((t) => t.id === storedId)) {
                setSelectedTrackId(storedId);
                const found = fetchedTracks.find((t) => t.id === storedId);
                if (found) setCurrentTrack(found.name);
              } else if (typeof payload.trackId === "string" && payload.trackId) {
                setSelectedTrackId(payload.trackId);
                localStorage.setItem("elev8-track-id", payload.trackId);
              } else if (fetchedTracks.length > 0) {
                setSelectedTrackId(fetchedTracks[0].id);
                localStorage.setItem("elev8-track-id", fetchedTracks[0].id);
                setCurrentTrack(fetchedTracks[0].name);
              }
            }
          } catch {
            // non-fatal
          }
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

  function handleTrackChange(id: string) {
    setSelectedTrackId(id);
    localStorage.setItem("elev8-track-id", id);
    const found = tracks.find((t) => t.id === id);
    if (found) setCurrentTrack(found.name);
    window.dispatchEvent(new StorageEvent("storage", { key: "elev8-track-id", newValue: id }));
  }

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

  const allSections = visibleNavItems
    .flatMap((item) => item.children ?? [])
    .filter((section) => Array.isArray(section.children) && section.children.length > 0);

  const sectionByLabel = new Map(allSections.map((section) => [section.label.toLowerCase(), section]));

  const gymSectionOrder: Array<"owner" | "admin" | "coach"> =
    userRole === "owner" ? ["owner", "admin", "coach"] : userRole === "admin" ? ["admin", "coach"] : userRole === "coach" ? ["coach"] : [];

  const rawGymEntries = gymSectionOrder.flatMap((label) => sectionByLabel.get(label)?.children ?? []);
  const gymDashboardEntry = rawGymEntries.find((e) => e.href === "/organization/gym-dashboard");
  const gymEntriesWithoutDashboard = rawGymEntries.filter((e) => e.href !== "/organization/gym-dashboard");
  const gymEntries = gymDashboardEntry ? [gymDashboardEntry, ...gymEntriesWithoutDashboard] : rawGymEntries;
  const athleteEntries = sectionByLabel.get("member")?.children ?? [];
  const visibleEntries = viewMode === "athlete" ? athleteEntries : gymEntries;

  const handleSwitchView = (nextMode: ViewMode) => {
    if (nextMode === "gym" && !canAccessGymView) {
      return;
    }

    setViewMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar-view-mode", nextMode);
    }
    router.push(nextMode === "gym" ? "/organization/gym-dashboard" : "/organization/member/athlete-dashboard");
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("elev8-theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  };

  const themeToggleLabel = theme === "dark" ? "Light mode" : "Dark mode";
  const brandLogoSrc = organizationLogoUrl || "/Elev8rlogo (1).png";
  const brandLogoAlt = organizationLogoUrl ? `${organizationName} logo` : "Elev8";
  const themeIcon = theme === "dark" ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7M18.6 18.6l-1.7-1.7M7.1 7.1 5.4 5.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M20.2 14.3A8.5 8.5 0 0 1 9.7 3.8a8.9 8.9 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
  const gymViewIcon = <Briefcase className="h-4 w-4" aria-hidden="true" />;
  const athleteViewIcon = <PersonStanding className="h-4 w-4" aria-hidden="true" />;
  const handleSignOut = () => {
    setMenuOpen(false);
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="relative z-10 min-h-screen">
      <div className="lg:hidden">
        <div className="app-shell-topbar px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center gap-3 text-left"
              aria-label="Open menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <Image
                  src={brandLogoSrc}
                  alt={brandLogoAlt}
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
              </span>
            </button>
            <div className="flex min-w-0 items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                {mobileQuickLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={isActive ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ffb1c4]/35 bg-[#ffb1c4]/12 text-[#ffdbe4] transition-colors" : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"}
                      aria-label={link.label}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {link.icon}
                    </Link>
                  );
                })}
              </div>
              {showViewToggle ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchView("gym")}
                    className={viewMode === "gym" ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ffb1c4]/35 bg-[#ffb1c4]/12 text-[#ffdbe4] transition-colors" : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"}
                    aria-label="Gym view"
                  >
                    {gymViewIcon}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchView("athlete")}
                    className={viewMode === "athlete" ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ffb1c4]/35 bg-[#ffb1c4]/12 text-[#ffdbe4] transition-colors" : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"}
                    aria-label="Athlete view"
                  >
                    {athleteViewIcon}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                aria-label={themeToggleLabel}
              >
                {themeIcon}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          />
          <aside className="app-shell-sidebar absolute inset-y-0 left-0 flex w-72 flex-col overflow-hidden px-3 py-6">
            <div className="flex items-center justify-between gap-2 px-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <Image
                  src={brandLogoSrc}
                  alt={brandLogoAlt}
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
              </span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-full border border-white/15 p-2 text-slate-300 transition hover:border-white/35 hover:text-slate-100"
                aria-label="Close menu"
              >
                {hamburgerIcon}
              </button>
            </div>

            <nav className="mt-6 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4 text-sm">
              <div className="space-y-1">
                {visibleEntries.map((entry) => {
                  const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
                  return (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      className={`app-nav-link flex items-center rounded-lg px-3 py-2 text-xs ${
                        isActive ? "app-nav-link-active" : ""
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
            </nav>
            <div className="mt-4 border-t border-white/10 px-2 pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside
        className={`app-shell-sidebar card-fade-in fixed inset-y-0 left-0 z-20 hidden px-3 py-6 lg:flex lg:flex-col ${
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
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <Image
                src={brandLogoSrc}
                alt={brandLogoAlt}
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
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
            className="rounded-full border border-white/15 p-2 text-slate-300 transition hover:border-white/35 hover:text-slate-100"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {hamburgerIcon}
          </button>
        </div>

        {sidebarCollapsed ? (
          <nav className="mt-6 flex flex-1 flex-col items-center gap-2 overflow-y-auto">
            {visibleEntries.map((entry) => {
              const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`group flex h-10 w-10 items-center justify-center rounded-xl border text-slate-300 transition ${
                    isActive
                      ? "border-[#ffb1c4]/35 bg-[#ffb1c4]/12 text-[#ffdbe4]"
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
          <nav className="mt-6 space-y-1 text-sm">
            {visibleEntries.map((entry) => {
              const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`app-nav-link flex items-center rounded-lg px-3 py-2 text-xs ${
                    isActive ? "app-nav-link-active" : ""
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="mr-2 text-slate-400">{getNavIcon(entry.href)}</span>
                  {entry.label}
                </Link>
              );
            })}
          </nav>
        )}
      </aside>

      <div className={`${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="app-shell-topbar hidden h-14 w-full items-center justify-between px-5 text-slate-100 lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{organizationName}</p>
            {tracks.length > 1 ? (
              <select
                value={selectedTrackId ?? ""}
                onChange={(e) => handleTrackChange(e.target.value)}
                className="mt-0.5 max-w-[200px] cursor-pointer bg-transparent text-xs text-slate-400 outline-none transition hover:text-slate-200"
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#161a20] text-slate-100">
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="truncate text-xs text-slate-400">Track: {currentTrack}</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            {showViewToggle ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchView("gym")}
                  className={viewMode === "gym" ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ffb1c4]/35 bg-[#ffb1c4]/12 text-[#ffdbe4] transition-colors" : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"}
                  aria-label="Gym view"
                >
                  {gymViewIcon}
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchView("athlete")}
                  className={viewMode === "athlete" ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ffb1c4]/35 bg-[#ffb1c4]/12 text-[#ffdbe4] transition-colors" : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"}
                  aria-label="Athlete view"
                >
                  {athleteViewIcon}
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              aria-label={themeToggleLabel}
            >
              {themeIcon}
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
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
              className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
              aria-label="User account"
            >
              <span className="truncate max-w-[160px]">{userName}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                {userInitial}
              </span>
            </button>

            {canAccessGymView ? (
              <Link
                href="/organization/admin/content"
                className="inline-flex items-center text-slate-300 transition hover:text-white"
                aria-label="Messenger"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M4 6h16v10H8l-4 3z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </Link>
            ) : null}

            <button
              type="button"
              className="inline-flex items-center text-slate-300 transition hover:text-white"
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M12 4a4 4 0 0 0-4 4v2.5c0 1.8-.7 3.5-2 4.7h12c-1.3-1.2-2-2.9-2-4.7V8a4 4 0 0 0-4-4z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                <path d="M10 18a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
              </svg>
            </button>

            {canAccessGymView ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="inline-flex items-center text-slate-300 transition hover:text-white"
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
                  <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-white/15 bg-[#161a20] p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        importInputRef.current?.click();
                      }}
                      disabled={isImportingResults}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {isImportingResults ? "Importing workout results..." : "Import Workout Results (CSV)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
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
          <div className="hidden border-b border-[#ffb1c4]/30 bg-[#2a1720] px-5 py-2 text-sm text-[#ffdbe6] lg:block">
            {topBarNotice}
          </div>
        ) : null}

        <main className={mainClasses}>{children}</main>
      </div>
    </div>
  );
}
