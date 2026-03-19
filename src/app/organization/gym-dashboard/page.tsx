import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function GymDashboardPage() {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization/member/athlete-dashboard");
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    redirect("/organization");
  }

  const metrics = await getGymMetrics(organizationId);

  return (
    <SidebarShell mainClassName="w-full px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Gym Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">Performance snapshot</h1>
          <p className="mt-3 text-sm text-slate-400">
            High-level gym metrics for owner, admin, and coach views.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Member Count</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.totalMembers}</p>
            <p className="mt-2 text-xs text-slate-500">Active member roles in current organization.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total MRR</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(metrics.totalMrr)}</p>
            <p className="mt-2 text-xs text-slate-500">Estimated from members x $150 (temporary).</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Coaching Staff</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.totalCoaches}</p>
            <p className="mt-2 text-xs text-slate-500">Users with coach role.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Leadership</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.totalOwners + metrics.totalAdmins}</p>
            <p className="mt-2 text-xs text-slate-500">Owner + admin seats.</p>
          </article>
        </section>
      </section>
    </SidebarShell>
  );
}
