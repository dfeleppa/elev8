import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import NutritionCoachClient from "./NutritionCoachClient";
import NutritionTopBar from "../nutrition/NutritionTopBar";

export default async function MemberNutritionCoachPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <section className="mx-auto w-full max-w-[1480px] px-6 pt-8 lg:px-10 lg:pt-10">
        <header>
          <h1 className="text-3xl font-semibold text-[var(--text)]">AI Coach</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Chat with Lia for instant answers, plan check-ins, and meal feedback.
          </p>
          <div className="mt-4">
            <NutritionTopBar active="ai-coach" />
          </div>
        </header>
      </section>
      <div className="mx-auto w-full max-w-[1480px]">
        <NutritionCoachClient />
      </div>
    </SidebarShell>
  );
}
