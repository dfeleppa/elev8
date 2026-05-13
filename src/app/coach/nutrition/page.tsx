import { Suspense } from "react";
import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import CoachNutritionDashboardClient from "./CoachNutritionDashboardClient";

export default async function CoachNutritionPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Coach</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">Nutrition Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
          Select a member to review their active macro plan, calculation inputs, estimated metabolism,
          adherence signals, check-ins, and plan history.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Loading nutrition dashboard...</p>}>
        <CoachNutritionDashboardClient />
      </Suspense>
    </SidebarShell>
  );
}
