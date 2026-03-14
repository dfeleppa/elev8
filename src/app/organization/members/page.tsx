import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type MemberRow = Record<string, unknown>;

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }

  return String(value);
}

function getOrderedColumns(rows: MemberRow[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }

  // Keep common identifiers first, then everything else in stable alpha order.
  const preferred = ["id", "organization_id", "member_id", "first_name", "last_name", "email", "created_at", "updated_at"];
  const all = Array.from(seen);
  const preferredInRows = preferred.filter((key) => seen.has(key));
  const remaining = all.filter((key) => !preferredInRows.includes(key)).sort((a, b) => a.localeCompare(b));
  return [...preferredInRows, ...remaining];
}

export default async function OrganizationMembersPage() {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    redirect("/organization");
  }

  const activeOrganizationId = organizationIds[0] ?? null;

  let query = supabaseAdmin.from("organization_members").select("*");
  if (activeOrganizationId) {
    query = query.eq("organization_id", activeOrganizationId);
  }

  let { data, error: membersError } = await query.order("created_at", { ascending: false });

  // If the table in this environment lacks organization_id, fallback to all rows.
  if (membersError && activeOrganizationId && membersError.message.toLowerCase().includes("organization_id")) {
    const retry = await supabaseAdmin.from("organization_members").select("*").order("created_at", { ascending: false });
    data = retry.data;
    membersError = retry.error;
  }

  const members = (data ?? []) as MemberRow[];
  const columns = getOrderedColumns(members);

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Organization Members</h1>
          <p className="mt-3 text-sm text-slate-400">Full rows from organization_members.</p>
        </header>

        <section className="glass-panel app-card rounded-[28px] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Source Table</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">organization_members</h2>
            </div>
            <span className="text-xs text-slate-400">{members.length} rows</span>
          </div>

          {membersError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              {membersError.message}
            </div>
          ) : null}

          <div className="app-table-shell mt-6 overflow-x-auto">
            <table className="app-table w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-400">
                  {columns.map((column) => (
                    <th key={column} className="px-4">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(columns.length, 1)}
                      className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400"
                    >
                      No rows found in organization_members.
                    </td>
                  </tr>
                ) : (
                  members.map((member, index) => (
                    <tr key={(member.id as string | undefined) ?? `row-${index}`}>
                      {columns.map((column, columnIndex) => (
                        <td
                          key={`${(member.id as string | undefined) ?? `row-${index}`}-${column}`}
                          className={`border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300 ${
                            columnIndex === 0 ? "rounded-l-2xl" : ""
                          } ${columnIndex === columns.length - 1 ? "rounded-r-2xl" : ""}`}
                        >
                          {formatCell(member[column])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </SidebarShell>
  );
}
