import { redirect } from "next/navigation";

import CoachSetupClient from "@/app/coach/CoachSetupClient";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import NutritionTopBar from "../NutritionTopBar";
import CoachPlanClient from "./CoachPlanClient";

type Props = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function MemberNutritionCoachPlanPage({ searchParams }: Props) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isSetupMode = rawMode === "setup";

  return (
    <SidebarShell mainClassName="w-full">
      <section className="mx-auto w-full max-w-[1480px] space-y-8 px-6 py-8 lg:px-10 lg:py-10">
        <header>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Plan</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Review your assigned nutrition plan, weekly check-ins, and progress notes.
          </p>
          <div className="mt-4">
            <NutritionTopBar active="coach" />
          </div>
        </header>

        {isSetupMode ? (
          <CoachSetupClient initialMode="setup" redirectAfterSaveTo="/member/nutrition/coach" />
        ) : (
          <CoachPlanClient />
        )}
      </section>
    </SidebarShell>
  );
}
