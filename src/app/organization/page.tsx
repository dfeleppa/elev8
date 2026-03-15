import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import SidebarShell from "../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../lib/member";
import { supabaseAdmin } from "../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type Organization = {
  id: string;
  name: string;
};

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

async function createOrganization(formData: FormData) {
  "use server";

  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    if (error) {
      console.error("Organization create blocked:", error);
    }
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length < 2 || name.length > 100) {
    console.error("Organization create blocked: invalid name", { name });
    return;
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (organizationError || !organization?.id) {
    if (organizationError) {
      console.error("Organization create failed:", organizationError.message);
    }
    return;
  }

  const { error: membershipError } = await supabaseAdmin
    .from("organization_memberships")
    .insert({
    organization_id: organization.id,
    user_id: userId,
    role: "owner",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (membershipError) {
    console.error("Organization membership create failed:", membershipError.message);
    return;
  }

  revalidatePath("/organization");
}

export default async function OrganizationPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId) {
    redirect("/api/auth/signin");
  }

  const organizations = await getOrganizations(userId);
  const sections = [
    { label: "Owner", href: "/organization/owner", minRole: "owner" as const },
    { label: "Admin", href: "/organization/admin", minRole: "admin" as const },
    { label: "Coach", href: "/organization/coach", minRole: "coach" as const },
    { label: "Member", href: "/organization/member", minRole: "member" as const },
  ].filter((section) => hasRole(section.minRole, role));

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Organization</h1>
          <p className="mt-3 text-sm text-slate-400">
            Teams, roles, and member access across the organization.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.label}
              href={section.href}
              className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{section.label}</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-50">
                {section.label} console
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Manage {section.label.toLowerCase()} access and workflows.
              </p>
            </Link>
          ))}
          <div className="glass-panel rounded-[26px] border border-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Organizations</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-50">{organizations.length}</h3>
            <p className="mt-2 text-sm text-slate-400">Connected to your account.</p>
          </div>
          {hasRole("admin", role) && (
            <form
              action={createOrganization}
              className="glass-panel flex flex-col gap-4 rounded-[26px] border border-white/5 p-6 md:col-span-2"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Create</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-50">New organization</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Add a new organization and make yourself the owner.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="org-name">Organization name</label>
                <input
                  id="org-name"
                  type="text"
                  name="name"
                  placeholder="e.g. Acme CrossFit"
                  aria-label="Organization name"
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/30 focus:outline-none"
                  title="Enter organization name (2-100 characters)"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white/90"
                  aria-label="Create organization"
                  title="Create organization"
                >
                  Create organization
                </button>
              </div>
            </form>
          )}
          {hasRole("admin", role) && (
            <Link
              href="/organization/members"
              className="glass-panel rounded-[26px] border border-white/5 p-6 transition hover:border-white/20"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Members</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-50">Organization roster</h3>
              <p className="mt-2 text-sm text-slate-400">Track users, roles, and access levels.</p>
            </Link>
          )}
        </section>
      </section>
    </SidebarShell>
  );
}
