import { redirect } from "next/navigation";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import NutritionTopBar from "../NutritionTopBar";
import CoachPlanClient from "./CoachPlanClient";

export default async function MemberNutritionCoachPlanPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <section className="premium-main-glow min-h-[calc(100vh-3.5rem)] w-full px-5 py-4 text-[#17141F] sm:px-8 lg:px-10 lg:py-6 2xl:px-12">
        <div className="flex w-full flex-col gap-5">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-head text-[28px] font-bold leading-tight tracking-normal text-[#17141F] sm:text-[32px]">
                Nutrition Plan
              </h1>
              <p className="mt-1 text-[15px] font-medium text-[#475467]">
                Review coach targets, weekly check-ins, and progress notes.
              </p>
            </div>
            <NutritionTopBar active="coach" />
          </header>

          <CoachPlanClient />
        </div>
      </section>
    </SidebarShell>
  );
}
