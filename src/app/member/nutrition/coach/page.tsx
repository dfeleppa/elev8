import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import NutritionTopBar from "../NutritionTopBar";

export default async function MemberNutritionCoachPlanPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <section className="mx-auto w-full max-w-[1480px] space-y-8 px-6 py-8 lg:px-10 lg:py-10">
        <header>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Coach</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Review your coach-assigned nutrition plan, weekly check-ins, and progress notes.
          </p>
          <div className="mt-4">
            <NutritionTopBar active="coach" />
          </div>
        </header>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Coach plan view coming soon.
          </p>
        </div>
      </section>
    </SidebarShell>
  );
}
