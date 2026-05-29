import { redirect } from "next/navigation";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import NutritionTopBar from "../../NutritionTopBar";
import CoachSetupClient from "@/app/coach/CoachSetupClient";

export default async function MemberNutritionPlanSetupPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <section className="premium-main-glow min-h-[calc(100vh-3.5rem)] w-full px-5 py-4 text-[#17141F] sm:px-8 lg:px-10 lg:py-6 2xl:px-12">
        <div className="flex w-full flex-col gap-4 sm:gap-5">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mt-[56px] flex h-10 items-center justify-center sm:mt-0 sm:h-auto sm:justify-start">
              <h1 className="max-w-[calc(100vw-136px)] truncate text-center font-head text-[18px] font-extrabold leading-tight tracking-normal text-[#17141F] sm:max-w-none sm:text-left sm:text-[32px]">
                Build Your Plan
              </h1>
            </div>
            <NutritionTopBar active="coach" />
          </header>

          <div className="premium-glass-card p-4 sm:p-6">
            <CoachSetupClient initialMode="setup" redirectAfterSaveTo="/member/nutrition/coach" />
          </div>
        </div>
      </section>
    </SidebarShell>
  );
}
