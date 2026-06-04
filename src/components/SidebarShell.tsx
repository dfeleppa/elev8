"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Micro } from "@/components/ui";
import { isMemberPathLive } from "@/lib/feature-flags";
import {
  Activity,
  Apple,
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Dumbbell,
  FileText,
  HandPlatter,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  MoreVertical,
  PlugZap,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tv,
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
    label: "Lyfe Fitness",
    href: "/",
    minRole: "member",
    children: [
      {
        label: "Coach",
        href: "/coach",
        minRole: "coach",
        children: [
          { label: "Gym Dashboard", href: "/gym-dashboard", minRole: "coach" },
          { label: "Nutrition", href: "/coach/nutrition", minRole: "coach" },
          { label: "Schedule", href: "/coach/schedule", minRole: "coach" },
          { label: "Reports - Members", href: "/coach/reports-members", minRole: "coach" },
        ],
      },
      {
        label: "Owner",
        href: "/owner",
        minRole: "owner",
        children: [
          { label: "Staff", href: "/owner/staff", minRole: "owner" },
          { label: "Class Setup", href: "/owner/schedule", minRole: "owner" },
          { label: "Payroll", href: "/owner/payroll", minRole: "owner" },
          { label: "Billing", href: "/owner/billing", minRole: "owner" },
          { label: "Tracks & Memberships", href: "/owner/tracks-memberships", minRole: "owner" },
          { label: "Members", href: "/owner/members", minRole: "owner" },
          { label: "Gym Settings", href: "/owner/settings", minRole: "owner" },
        ],
      },
      {
        label: "Admin",
        href: "/admin",
        minRole: "admin",
        children: [
          { label: "Management", href: "/management", minRole: "admin" },
          { label: "Content", href: "/admin/content", minRole: "admin" },
          { label: "Business Analytics", href: "/admin/analytics", minRole: "admin" },
          { label: "Programming", href: "/admin/programming", minRole: "admin" },
        ],
      },
      {
        label: "Member",
        href: "/member",
        minRole: "member",
        children: [
          { label: "Athlete Dashboard", href: "/member/athlete-dashboard", minRole: "member" },
          { label: "Workout", href: "/member/workout", minRole: "member" },
          { label: "Chat", href: "/member/chat", minRole: "member" },
          { label: "Nutrition", href: "/member/nutrition", minRole: "member" },
          { label: "Class Schedule", href: "/member/class-schedule", minRole: "member" },
          { label: "Account Dashboard", href: "/member/account-dashboard", minRole: "member" },
          { label: "Store", href: "/member/store", minRole: "member" },
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

const mobileQuickLinks: Array<{ label: string; href: string | null; icon: ReactNode }> = [
  { label: "Workout", href: "/member/workout", icon: <Dumbbell className="h-5 w-5" aria-hidden="true" /> },
  { label: "Chat", href: "/member/chat", icon: <MessageCircle className="h-5 w-5" aria-hidden="true" /> },
  { label: "Athlete", href: "/member/athlete-dashboard", icon: <Activity className="h-5 w-5" aria-hidden="true" /> },
  { label: "Schedule", href: "/member/class-schedule", icon: <CalendarDays className="h-5 w-5" aria-hidden="true" /> },
  { label: "Nutrition", href: "/member/nutrition", icon: <Apple className="h-5 w-5" aria-hidden="true" /> },
] as const;

/**
 * Prioritized gym-side bottom nav links. Role-filtered then sliced to the top 4,
 * so each role lands on destinations it can actually reach. A "More" button is
 * appended at render time to open the full sidebar for everything else.
 */
const gymQuickLinks: { label: string; href: string; icon: ReactNode; minRole: UserRole }[] = [
  { label: "Dashboard", href: "/gym-dashboard", minRole: "coach", icon: <BarChart3 className="h-5 w-5" aria-hidden="true" /> },
  { label: "Schedule", href: "/coach/schedule", minRole: "coach", icon: <CalendarDays className="h-5 w-5" aria-hidden="true" /> },
  { label: "Programming", href: "/admin/programming", minRole: "admin", icon: <Dumbbell className="h-5 w-5" aria-hidden="true" /> },
  { label: "Members", href: "/owner/members", minRole: "owner", icon: <Users className="h-5 w-5" aria-hidden="true" /> },
  { label: "Nutrition", href: "/coach/nutrition", minRole: "coach", icon: <HandPlatter className="h-5 w-5" aria-hidden="true" /> },
  { label: "Reports", href: "/coach/reports-members", minRole: "coach", icon: <ClipboardList className="h-5 w-5" aria-hidden="true" /> },
];

/** Static section groupings for the athlete view nav */
const ATHLETE_SECTIONS = [
  { label: "Today",    hrefs: ["/member/athlete-dashboard"] },
  { label: "Train",    hrefs: ["/member/workout"] },
  { label: "Community", hrefs: ["/member/chat"] },
  { label: "Schedule", hrefs: ["/member/class-schedule"] },
  { label: "Nutrition",hrefs: ["/member/nutrition", "/member/nutrition/coach", "/member/nutrition-coach"] },
  { label: "Account",  hrefs: ["/member/account-dashboard", "/member/store"] },
] as const;

const mobileTitleRoutes = [
  ["/member/nutrition/coach", "Nutrition Coach"],
  ["/member/nutrition-coach", "Nutrition Coach"],
  ["/member/chat", "Chat"],
  ["/member/athlete-dashboard", "Athlete"],
  ["/member/account-dashboard", "Account"],
  ["/member/class-schedule", "Class Schedule"],
  ["/member/nutrition", "Nutrition"],
  ["/member/workout", "Workout"],
  ["/member/store", "Store"],
] as const;

function getNavIcon(href: string) {
  const iconClass = "h-[18px] w-[18px]";
  const iconProps = {
    className: iconClass,
    strokeWidth: 1.9,
    "aria-hidden": true as const,
  };

  switch (href) {
    case "/owner/agents":
      return <Bot {...iconProps} />;
    case "/owner/staff":
    case "/owner/members":
    case "/members":
      return <Users {...iconProps} />;
    case "/owner/schedule":
    case "/member/class-schedule":
      return <CalendarDays {...iconProps} />;
    case "/owner/payroll":
    case "/owner/billing":
      return <Wallet {...iconProps} />;
    case "/owner/store-setup":
    case "/member/store":
      return <ShoppingBag {...iconProps} />;
    case "/owner/tracks-memberships":
      return <ShieldCheck {...iconProps} />;
    case "/owner/integrations":
      return <PlugZap {...iconProps} />;
    case "/owner/settings":
      return <Settings {...iconProps} />;
    case "/management":
      return <Briefcase {...iconProps} />;
    case "/gym-dashboard":
      return <BarChart3 {...iconProps} />;
    case "/admin/content":
      return <FileText {...iconProps} />;
    case "/admin/analytics":
      return <BarChart3 {...iconProps} />;
    case "/admin/programming":
    case "/admin/programming/builder":
    case "/member/workout":
      return <Dumbbell {...iconProps} />;
    case "/member/chat":
      return <MessageCircle {...iconProps} />;
    case "/coach/nutrition":
    case "/coach/nutrition-coach":
    case "/member/nutrition-coach":
      return <HandPlatter {...iconProps} />;
    case "/coach/schedule":
      return <CalendarDays {...iconProps} />;
    case "/coach/reports-members":
      return <ClipboardList {...iconProps} />;
    case "/member/athlete-dashboard":
      return <Activity {...iconProps} />;
    case "/member/nutrition":
      return <HandPlatter {...iconProps} />;
    case "/member/account-dashboard":
      return <UserCircle2 {...iconProps} />;
    default:
      return <CircleDot {...iconProps} />;
  }
}

export default function SidebarShell({ children, mainClassName }: SidebarShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewMode, setViewMode] = useState<ViewMode>("gym");
  const [userRole, setUserRole] = useState<UserRole>("member");
  const [userName, setUserName] = useState("User");
  const [gymName, setGymName] = useState("Lyfe Fitness");
  const [currentTrack, setCurrentTrack] = useState("Main");
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
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
    if (!comingSoon) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setComingSoon(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [comingSoon]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem("elev8-theme");
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    // Path takes priority: gym-role routes always show gym sidebar,
    // member routes always show athlete sidebar.
    if (
      pathname?.startsWith("/owner") ||
      pathname?.startsWith("/admin") ||
      pathname?.startsWith("/coach") ||
      pathname?.startsWith("/management") ||
      pathname?.startsWith("/gym-dashboard")
    ) {
      setViewMode("gym");
      return;
    }
    if (pathname?.startsWith("/member")) {
      setViewMode("athlete");
      return;
    }

    // For other paths fall back to localStorage, then role default.
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

    setViewMode(canAccessGymView ? "gym" : "athlete");
  }, [canAccessGymView, pathname]);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      try {
        // Fetch role + tracks in parallel — they don't depend on each other.
        const [meResponse, tracksResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/programming/tracks", { cache: "no-store" }).catch(() => null),
        ]);

        const payload = await meResponse.json();
        if (!meResponse.ok || !payload?.role) {
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
        if (isMounted && typeof payload.gymName === "string" && payload.gymName.trim()) {
          setGymName(payload.gymName.trim());
        }
        if (isMounted && typeof payload.currentTrack === "string" && payload.currentTrack.trim()) {
          setCurrentTrack(payload.currentTrack.trim());
        }

        if (isMounted && tracksResponse && tracksResponse.ok) {
          try {
            const tp = await tracksResponse.json();
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
  const firstName = userName.trim().split(/\s+/)[0] || "User";
  const showMobileMemberNav = pathname?.startsWith("/member");
  const isGymRoute =
    pathname?.startsWith("/owner") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/coach") ||
    pathname?.startsWith("/management") ||
    pathname?.startsWith("/gym-dashboard");
  const showMobileGymNav = Boolean(isGymRoute) && canAccessGymView;
  const gymBottomLinks: { label: string; href: string; icon: ReactNode }[] = [
    ...gymQuickLinks.filter((link) => canViewRole(link.minRole)).slice(0, 4),
    // Payroll replaces the "More" button — owner-only.
    ...(canViewRole("owner")
      ? [{ label: "Payroll", href: "/owner/payroll", icon: <Wallet className="h-5 w-5" aria-hidden="true" /> }]
      : []),
  ];
  const gymBottomGridCols = gymBottomLinks.length >= 5 ? "grid-cols-5" : "grid-cols-4";
  const mobileTopBarTitle =
    pathname === "/member/nutrition"
      ? ""
      : mobileTitleRoutes.find(([href]) => pathname === href || pathname?.startsWith(href + "/"))?.[1] ?? "";

  /** Members see locked (not-yet-live) routes greyed out with a Coming Soon modal. */
  const isLocked = (href: string) => userRole === "member" && !isMemberPathLive(href);

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
  const gymDashboardEntry = rawGymEntries.find((e) => e.href === "/gym-dashboard");
  const gymEntriesWithoutDashboard = rawGymEntries.filter((e) => e.href !== "/gym-dashboard");
  const gymEntries = gymDashboardEntry ? [gymDashboardEntry, ...gymEntriesWithoutDashboard] : rawGymEntries;
  const athleteEntries = sectionByLabel.get("member")?.children ?? [];
  const visibleEntries = viewMode === "athlete" ? athleteEntries : gymEntries;

  /** Grouped nav sections used to render <Micro> headers in expanded sidebar */
  const navSections: { label: string; entries: NavChild[] }[] =
    viewMode === "athlete"
      ? ATHLETE_SECTIONS.map(({ label, hrefs }) => ({
          label,
          entries: athleteEntries.filter((e) => (hrefs as readonly string[]).includes(e.href)),
        })).filter((s) => s.entries.length > 0)
      : (() => {
          const sections: { label: string; entries: NavChild[] }[] = [];
          if (gymDashboardEntry) {
            sections.push({ label: "Overview", entries: [gymDashboardEntry] });
          }
          const GYM_LABELS: Record<string, string> = {
            owner: "Management",
            admin: "Operations",
            coach: "Coaching",
          };
          for (const key of gymSectionOrder) {
            const entries = (sectionByLabel.get(key)?.children ?? []).filter(
              (e) => e.href !== "/gym-dashboard"
            );
            if (entries.length > 0) {
              sections.push({ label: GYM_LABELS[key] ?? key, entries });
            }
          }
          return sections;
        })();

  const handleSwitchView = (nextMode: ViewMode) => {
    if (nextMode === "gym" && !canAccessGymView) {
      return;
    }

    setViewMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar-view-mode", nextMode);
    }
    router.push(nextMode === "gym" ? "/gym-dashboard" : "/member/athlete-dashboard");
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
  const stackedLogoSrc = theme === "dark" ? "/light_stacked.png" : "/dark_stacked.png";
  const wideLogoSrc = theme === "dark" ? "/light_wide.png" : "/dark_wide.png";
  const brandLogoAlt = gymName + " logo";
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
  const viewToggleBaseCls =
    "inline-flex items-center justify-center rounded-full px-3 h-8 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] transition-colors";
  const viewToggleActiveSidebarCls =
    `${viewToggleBaseCls} bg-white text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(16,24,40,0.08)]`;
  const viewToggleInactiveSidebarCls =
    `${viewToggleBaseCls} text-[#667085] hover:bg-white/60 hover:text-[#17141F]`;
  const handleSignOut = () => {
    setMenuOpen(false);
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="relative z-10 min-h-screen">
      <div className="lg:hidden">
        <div className="app-shell-topbar relative z-40 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-[rgba(20,210,220,0.08)]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              {mobileTopBarTitle ? (
                <h1 className="truncate font-head text-[18px] font-bold leading-tight text-[#17141F]">
                  {mobileTopBarTitle}
                </h1>
              ) : null}
            </div>
            <div className="relative flex min-w-0 items-center justify-end">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#475467] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-[rgba(20,210,220,0.08)] hover:text-[#17141F]"
                aria-label="More options"
                aria-expanded={menuOpen}
              >
                <MoreVertical className="h-5 w-5" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-[90] w-52 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/92 p-2 shadow-[0_20px_50px_rgba(16,24,40,0.16)] backdrop-blur-xl">
                  {canAccessGymView ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleSwitchView(showMobileMemberNav ? "gym" : "athlete");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-[#17141F] transition hover:bg-[rgba(20,210,220,0.08)]"
                    >
                      {showMobileMemberNav ? (
                        <Briefcase className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Activity className="h-4 w-4" aria-hidden="true" />
                      )}
                      {showMobileMemberNav ? "Switch to Gym" : "Switch to Member"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      toggleTheme();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-[#17141F] transition hover:bg-[rgba(20,210,220,0.08)]"
                  >
                    {themeIcon}
                    {themeToggleLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-[#17141F] transition hover:bg-[rgba(255,92,168,0.08)]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showMobileMemberNav ? (
        <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-[24px] border border-white/80 bg-white/82 p-1.5 shadow-[0_18px_48px_rgba(16,24,40,0.18)] backdrop-blur-xl lg:hidden" aria-label="Member mobile navigation">
          {mobileQuickLinks.map((link) => {
            const locked = !link.href || isLocked(link.href);
            const isActive = link.href && !locked ? pathname === link.href || pathname.startsWith(link.href + "/") : false;
            if (locked) {
              return (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => setComingSoon(link.label)}
                  className="relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 text-[#98A2B3] opacity-70"
                  aria-label={`${link.label} coming soon`}
                >
                  {link.icon}
                  <span className="truncate text-[10px] font-bold">{link.label}</span>
                </button>
              );
            }

            const href = link.href as string;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 transition ${
                  isActive
                    ? "bg-white/55 text-[#17141F] after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-[#14D2DC] after:shadow-[0_0_12px_rgba(20,210,220,0.42)]"
                    : "text-[#667085] hover:bg-[rgba(20,210,220,0.08)] hover:text-[#17141F]"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={link.label}
              >
                {link.icon}
                <span className="truncate text-[10px] font-bold">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {showMobileGymNav ? (
        <nav className={`fixed inset-x-3 bottom-3 z-30 grid ${gymBottomGridCols} rounded-[24px] border border-white/80 bg-white/82 p-1.5 shadow-[0_18px_48px_rgba(16,24,40,0.18)] backdrop-blur-xl lg:hidden`} aria-label="Gym mobile navigation">
          {gymBottomLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 transition ${
                  isActive
                    ? "bg-white/55 text-[#17141F] after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-[#14D2DC] after:shadow-[0_0_12px_rgba(20,210,220,0.42)]"
                    : "text-[#667085] hover:bg-[rgba(20,210,220,0.08)] hover:text-[#17141F]"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={link.label}
              >
                {link.icon}
                <span className="truncate text-[10px] font-bold">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          />
          <aside className="app-shell-sidebar absolute inset-y-0 left-0 flex w-72 flex-col overflow-hidden px-3 py-3">
            <div className="flex items-center justify-between gap-2 rounded-[20px] border border-white/75 bg-white/58 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <Image src={wideLogoSrc} alt={brandLogoAlt} width={132} height={34} className="h-8 w-auto object-contain" />
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 text-[#17141F] transition hover:bg-[rgba(20,210,220,0.08)]"
                aria-label="Close menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="mt-4 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pb-4 text-sm">
              {navSections.map((section) => (
                <div key={section.label}>
                  <div className="mb-1 px-3">
                    <Micro className="!text-[10px] !font-bold !tracking-[0.15em] !text-[#4F5B6B]">{section.label}</Micro>
                  </div>
                  <div className="space-y-1">
                    {section.entries.map((entry) => {
                      if (isLocked(entry.href)) {
                        return (
                          <button
                            key={entry.href}
                            type="button"
                            onClick={() => {
                              setMobileSidebarOpen(false);
                              setComingSoon(entry.label);
                            }}
                            className="app-nav-link flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-bold opacity-60"
                            aria-label={`${entry.label} coming soon`}
                          >
                            <span className="grid h-5 w-5 shrink-0 place-items-center text-[#667085]">{getNavIcon(entry.href)}</span>
                            <span className="flex-1 text-left">{entry.label}</span>
                            <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">Soon</span>
                          </button>
                        );
                      }
                      const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
                      return (
                        <Link
                          key={entry.href}
                          href={entry.href}
                          className={`app-nav-link flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                            isActive ? "app-nav-link-active" : ""
                          }`}
                          onClick={() => setMobileSidebarOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center text-[#667085]">{getNavIcon(entry.href)}</span>
                          {entry.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-4 border-t border-[var(--line)] px-2 pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside
        className={`app-shell-sidebar card-fade-in fixed inset-y-0 left-0 z-20 hidden px-3 py-5 lg:flex lg:flex-col ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
        style={{ animationDelay: "0.05s" }}
      >
        <div className="px-2">
          <div className="flex min-h-11 items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
              className={`flex items-center ${sidebarCollapsed ? "justify-center" : "flex-1"}`}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Sidebar logo"}
            >
              {sidebarCollapsed ? (
                <Image
                  src={stackedLogoSrc}
                  alt={brandLogoAlt}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <Image
                  src={wideLogoSrc}
                  alt={brandLogoAlt}
                  width={160}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              className="rounded-full border border-[var(--line-strong)] p-2 text-[var(--text-muted)] transition hover:border-[var(--line-focus)] hover:text-[var(--text)]"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {hamburgerIcon}
            </button>
          </div>
          {showViewToggle ? (
            <div
              className={`mt-4 gap-1 rounded-[18px] border border-white/75 bg-white/48 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${
                sidebarCollapsed ? "flex flex-col items-stretch" : "grid grid-cols-2"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSwitchView("gym")}
                className={
                  (viewMode === "gym" ? viewToggleActiveSidebarCls : viewToggleInactiveSidebarCls) +
                  (sidebarCollapsed ? " w-full" : " flex-1")
                }
                aria-pressed={viewMode === "gym"}
                aria-label="Gym view"
              >
                Gym
              </button>
              <button
                type="button"
                onClick={() => handleSwitchView("athlete")}
                className={
                  (viewMode === "athlete" ? viewToggleActiveSidebarCls : viewToggleInactiveSidebarCls) +
                  (sidebarCollapsed ? " w-full" : " flex-1")
                }
                aria-pressed={viewMode === "athlete"}
                aria-label="Member view"
              >
                Member
              </button>
            </div>
          ) : null}
        </div>

        {sidebarCollapsed ? (
          <nav className="mt-5 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
            {visibleEntries.map((entry) => {
              if (isLocked(entry.href)) {
                return (
                  <button
                    key={entry.href}
                    type="button"
                    onClick={() => setComingSoon(entry.label)}
                    className="group flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--text-muted)] opacity-60 transition hover:border-[var(--line)] hover:bg-[var(--panel-2)]"
                    aria-label={`${entry.label} coming soon`}
                    title={`${entry.label} — coming soon`}
                  >
                    {getNavIcon(entry.href)}
                  </button>
                );
              }
              const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`group flex h-10 w-10 items-center justify-center rounded-xl border text-[var(--text-muted)] transition ${
                    isActive
                      ? "border-[var(--pink)]/35 bg-[var(--pink)]/12 text-[var(--pink-soft)]"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
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
          <nav className="mt-4 space-y-2.5 overflow-y-auto text-sm">
            {navSections.map((section) => (
              <div key={section.label}>
                <div className="mb-1 px-3">
                  <Micro className="!text-[10px] !font-bold !tracking-[0.15em] !text-[#4F5B6B]">{section.label}</Micro>
                </div>
                <div className="space-y-1">
                  {section.entries.map((entry) => {
                    if (isLocked(entry.href)) {
                      return (
                        <button
                          key={entry.href}
                          type="button"
                          onClick={() => setComingSoon(entry.label)}
                          className="app-nav-link flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-bold opacity-60"
                          aria-label={`${entry.label} coming soon`}
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center text-[#667085]">{getNavIcon(entry.href)}</span>
                          <span className="flex-1 text-left">{entry.label}</span>
                          <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">Soon</span>
                        </button>
                      );
                    }
                    const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
                    return (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        className={`app-nav-link flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-bold ${
                          isActive ? "app-nav-link-active" : ""
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center text-[#667085]">{getNavIcon(entry.href)}</span>
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
        <header className="app-shell-topbar hidden h-14 w-full items-center justify-end px-5 text-[var(--text)] lg:flex">
          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
              aria-label={themeToggleLabel}
            >
              {themeIcon}
            </button>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
              aria-label="TV display mode"
              title="TV Display Mode"
            >
              <Tv className="h-4 w-4" aria-hidden="true" />
            </button>

            {tracks.length > 1 ? (
              <select
                value={selectedTrackId ?? ""}
                onChange={(e) => handleTrackChange(e.target.value)}
                className="max-w-[200px] cursor-pointer bg-transparent text-xs text-[var(--text-muted)] outline-none transition hover:text-[var(--text)]"
                aria-label="Select track"
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[var(--panel-2)] text-[var(--text)]">
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate text-xs text-[var(--text-muted)]">{currentTrack}</span>
            )}

            <button
              type="button"
              className="inline-flex items-center gap-2 text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label="User account"
            >
              <span className="truncate max-w-[160px]">{firstName}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--panel-2)] text-xs font-semibold text-[var(--text)]">
                {userInitial}
              </span>
            </button>

            {canAccessGymView ? (
              <Link
                href="/admin/content"
                className="inline-flex items-center text-[var(--text-muted)] transition hover:text-[var(--text)]"
                aria-label="Messenger"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M4 6h16v10H8l-4 3z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </Link>
            ) : null}

            <button
              type="button"
              className="inline-flex items-center text-[var(--text-muted)] transition hover:text-[var(--text)]"
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
                  className="inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
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
                  <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        importInputRef.current?.click();
                      }}
                      disabled={isImportingResults}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--panel)] disabled:opacity-60"
                    >
                      {isImportingResults ? "Importing workout results..." : "Import Workout Results (CSV)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--panel)]"
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
          <div className="hidden border-b border-[var(--pink)]/30 bg-[var(--panel)] px-5 py-2 text-sm text-[var(--pink-soft)] lg:block">
            {topBarNotice}
          </div>
        ) : null}

        <main className={`${mainClasses} ${showMobileMemberNav || showMobileGymNav ? "pb-28 lg:pb-0" : ""}`}>{children}</main>
      </div>

      {comingSoon ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${comingSoon} coming soon`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setComingSoon(null)}
            aria-label="Close"
          />
          <div className="app-card card-fade-in relative z-10 w-full max-w-sm rounded-[24px] p-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--panel-2)] text-[var(--pink-soft)]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-[-0.02em] text-[var(--text)]">Coming Soon</h2>
            <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
              {comingSoon} isn&apos;t ready yet — it&apos;s on the way. For now you&apos;ve got Nutrition.
            </p>
            <button
              type="button"
              onClick={() => setComingSoon(null)}
              className="mt-6 w-full rounded-full bg-[var(--pink)] px-4 py-2.5 text-sm font-bold text-[#17141F] transition hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
