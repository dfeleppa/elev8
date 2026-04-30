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
      <NutritionTopBar active="coach" />
      <div className="mx-auto w-full max-w-[1480px]">
        <NutritionCoachClient />
      </div>
    </SidebarShell>
  );
}
