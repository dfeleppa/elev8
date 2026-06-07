import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OwnerSectionCard from "@/components/owner/OwnerSectionCard";
import MemberImportButton from "@/components/owner/MemberImportButton";
import OwnerMembersTable from "./OwnerMembersTable";
import { uiCopyClass, uiTitleClass } from "@/components/ui";

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
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  birth_date?: string | null;
  tags?: string | null;
  attendance_count?: number | null;
  status_notes?: string | null;
};

async function getOwnerMembers() {
  const richSelect =
    "first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role, status, tracks, last_active, phone, gender, address, birth_date, tags, attendance_count, status_notes";
  const baseSelect =
    "first_name, last_name, membership, last_check_in, mrr, created_at, updated_at, email, role";

  const richQuery = await supabaseAdmin
    .from("app_users")
    .select(richSelect)
    .order("created_at", { ascending: false });

  if (!richQuery.error) {
    return richQuery;
  }

  return supabaseAdmin
    .from("app_users")
    .select(baseSelect)
    .order("created_at", { ascending: false });
}

export default async function OwnerMembersPage() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    redirect("/owner");
  }

  const { data, error: membersError } = await getOwnerMembers();
  const members = (data ?? []) as OwnerMemberRow[];

  return (
    <SidebarShell mainClassName="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className={uiTitleClass}>Members</h1>
          <p className={`mt-3 ${uiCopyClass}`}>
            Member directory with status, membership, and activity details.
          </p>
        </header>

        <OwnerSectionCard
          title="Member Directory"
          meta={`${members.length} rows`}
          headerRight={<MemberImportButton />}
        >
          {membersError ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              {membersError.message}
            </div>
          ) : null}
          <OwnerMembersTable rows={members} />
        </OwnerSectionCard>
      </section>
    </SidebarShell>
  );
}
