import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type Organization = {
  id: string;
  name: string;
};

type MembershipRow = {
  id: string;
  role: string | null;
  user_id: string | null;
};

type AppUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

function formatRole(value: string | null | undefined) {
  if (!value) {
    return "Member";
  }
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

function getInitials(value: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "?";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

async function getOrganizations(userId: string): Promise<Organization[]> {
  const { data, error } = await supabaseAdmin
    .from("organization_memberships")
    .select("organization:organizations(id, name)")
    .eq("user_id", userId);

  if (error) {
    return [];
  }

  return (data ?? [])
    .map((row) => (Array.isArray(row.organization) ? row.organization[0] : row.organization))
    .filter((org): org is Organization => Boolean(org?.id));
}

async function getMemberships(organizationId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabaseAdmin
    .from("organization_memberships")
    .select("id, role, user_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return data ?? [];
}

async function getUsers(userIds: string[]): Promise<AppUser[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, email, role")
    .in("id", userIds);

  if (error) {
    return [];
  }

  return data ?? [];
}

export default async function OrganizationMembersPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/health");
  }

  const organizations = await getOrganizations(userId);
  const activeOrganization = organizations[0] ?? null;

  if (!activeOrganization) {
    return (
      <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
        <section>
          <h1 className="text-3xl font-semibold text-slate-100">Organization Members</h1>
          <p className="mt-3 text-sm text-slate-400">No organization memberships found yet.</p>
        </section>
      </SidebarShell>
    );
  }

  const memberships = await getMemberships(activeOrganization.id);
  const userIds = memberships.map((membership) => membership.user_id).filter(Boolean) as string[];
  const users = await getUsers(userIds);

  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Organization Members</h1>
          <p className="mt-3 text-sm text-slate-400">Roster for {activeOrganization.name}.</p>
        </header>

        <section className="glass-panel rounded-[28px] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Roster</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Members</h2>
            </div>
            <span className="text-xs text-slate-400">{memberships.length} total</span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-400">
                  <th className="px-4">Name</th>
                  <th className="px-4">Email</th>
                  <th className="px-4">Org Role</th>
                  <th className="px-4">User Role</th>
                </tr>
              </thead>
              <tbody>
                {memberships.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400"
                    >
                      No members found yet.
                    </td>
                  </tr>
                ) : (
                  memberships.map((membership) => {
                    const user = membership.user_id ? userMap.get(membership.user_id) : null;
                    const displayName = user?.full_name ?? user?.email ?? "Unknown";

                    return (
                      <tr key={membership.id}>
                        <td className="rounded-l-2xl border-y border-white/10 bg-white/5 px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-semibold text-slate-200">
                              {getInitials(displayName)}
                            </span>
                            <div>
                              <p className="text-base font-semibold text-slate-50">{displayName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                          {user?.email ?? "—"}
                        </td>
                        <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                          {formatRole(membership.role)}
                        </td>
                        <td className="rounded-r-2xl border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                          {formatRole(user?.role)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </SidebarShell>
  );
}
