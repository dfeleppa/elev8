import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AthleteDashboardClient from "./AthleteDashboardClient";

async function getTotalWorkoutsLogged(userId: string) {
  const { count, error } = await supabaseAdmin
    .from("workout_results")
    .select("id", { count: "exact", head: true })
    .eq("member_id", userId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export default async function MemberAthleteDashboardPage({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] } | Promise<{ tab?: string | string[] }>;
}) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }
  if (isMemberRouteLocked(role, "/member/athlete-dashboard")) {
    redirect("/member/nutrition");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const tabParam = Array.isArray(resolvedSearchParams?.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams?.tab;
  const initialTab = tabParam?.trim().toLowerCase() ?? "dashboard";

  const totalWorkoutsLogged = await getTotalWorkoutsLogged(userId);

  return (
    <div className="w-full pb-10 lg:pb-16">
      <AthleteDashboardClient
        initialTab={initialTab}
        totalWorkoutsLogged={totalWorkoutsLogged}
      />
    </div>
  );
}
