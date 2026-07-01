import type { ReactNode } from "react";

import SidebarShell from "@/components/SidebarShell";

export const dynamic = "force-dynamic";

// Single shell instance for every authenticated app page. Mounting it here
// (instead of per-page) preserves sidebar state across navigations and avoids
// refetching the user role on every page change.
export default function AppShellLayout({ children }: { children: ReactNode }) {
  return <SidebarShell>{children}</SidebarShell>;
}
