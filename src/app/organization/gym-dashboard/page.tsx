import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import GymDashboardClient from "./GymDashboardClient";
import type { OwnerMemberRow } from "../owner/members/page";

export const dynamic = "force-dynamic";

type DashboardMetrics = {
  totalMembers: number;
  totalCoaches: number;
  totalAdmins: number;
  totalOwners: number;
  totalMrr: number;
};

async function getGymMetrics(organizationId: string): Promise<DashboardMetrics> {
  const { data, error } = await supabaseAdmin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId);

  if (error) {
    return {
      totalMembers: 0,
      totalCoaches: 0,
      totalAdmins: 0,
      totalOwners: 0,
      totalMrr: 0,
    };
  }

  const rows = data ?? [];
  const totalMembers = rows.filter((row) => row.role === "member").length;
  const totalCoaches = rows.filter((row) => row.role === "coach").length;
  const totalAdmins = rows.filter((row) => row.role === "admin").length;
  const totalOwners = rows.filter((row) => row.role === "owner").length;

  const estimatedArpu = 150;
  const totalMrr = totalMembers * estimatedArpu;

  return {
    totalMembers,
    totalCoaches,
    totalAdmins,
    totalOwners,
    totalMrr,
  };
}


export default async function GymDashboardPage({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] } | Promise<{ tab?: string | string[] }>;
}) {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization/member/athlete-dashboard");
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    redirect("/organization");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const tabParam = Array.isArray(resolvedSearchParams?.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams?.tab;
  const initialTab = tabParam?.trim().toLowerCase() ?? "dashboard";

  const [metrics, membersResult] = await Promise.all([
    getGymMetrics(organizationId),
    supabaseAdmin
      .from("organization_members")
      .select("first_name, last_name, email, membership, last_check_in, last_active, updated_at, birth_date, tags, tracks, status, attendance_count")
      .eq("organization_id", organizationId),
  ]);

  const members = (membersResult.data ?? []) as OwnerMemberRow[];

  return (
    <SidebarShell mainClassName="w-full pb-10 lg:pb-16">
      <GymDashboardClient initialTab={initialTab} metrics={metrics} members={members} />
    </SidebarShell>
  );
}
