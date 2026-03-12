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
};

export default async function OwnerMembersPage() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const { data, error: membersError } = await supabaseAdmin
    .from("organization_members")
    .select("first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role")
    .order("created_at", { ascending: false });

  const members = (data ?? []) as OwnerMemberRow[];

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Members</h1>
          <p className="mt-3 text-sm text-slate-400">
            Full rows from organization_members.
          </p>
        </header>

        <section className="glass-panel rounded-[28px] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Owner Members</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">organization_members</h2>
            </div>
            <span className="text-xs text-slate-400">{members.length} rows</span>
          </div>

          {membersError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {membersError.message}
            </div>
          ) : null}

          <OwnerMembersTable rows={members} />
        </section>
      </section>
    </SidebarShell>
  );
}
