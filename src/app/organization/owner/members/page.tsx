import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import OwnerMembersTable from "./OwnerMembersTable";

export const dynamic = "force-dynamic";

export type OwnerMemberRow = {
  first_name: string | null;
  last_name: string | null;
  membership: string | null;
  last_check_in: string | null;
  mrr: number | null;
  created_at: string | null;
  updated_at: string | null;
  email: string | null;
  role: string | null;
  status?: string | null;
  tracks?: string | null;
  last_active?: string | null;
};

async function getOwnerMembers() {
  const richSelect =
    "first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role, status, tracks, last_active";
  const baseSelect =
    "first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role";

  const richQuery = await supabaseAdmin
    .from("organization_members")
    .select(richSelect)
    .order("created_at", { ascending: false });

  if (!richQuery.error) {
    return richQuery;
  }

  // Backward compatibility for environments where status/tracks columns are not present.
  return supabaseAdmin
    .from("organization_members")
    .select(baseSelect)
    .order("created_at", { ascending: false });
}

export default async function OwnerMembersPage() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const { data, error: membersError } = await getOwnerMembers();

  const members = (data ?? []) as OwnerMemberRow[];

  return (
    <SidebarShell mainClassName="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Members</h1>
          <p className="mt-3 text-sm text-slate-300">
            Member directory with status, membership, and activity details.
          </p>
        </header>

        <section className="rounded-[28px] border border-slate-200/80 bg-[#f6f4ef] p-3 shadow-[0_14px_34px_rgba(9,18,29,0.24)] md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Owner Members</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Directory</h2>
            </div>
            <span className="text-xs font-medium text-slate-500">{members.length} rows</span>
          </div>

          {membersError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              {membersError.message}
            </div>
          ) : null}

          <OwnerMembersTable rows={members} />
        </section>
      </section>
    </SidebarShell>
  );
}
