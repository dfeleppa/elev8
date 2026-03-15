import { redirect } from "next/navigation";
import Link from "next/link";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function OrganizationAdminPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Admin</h1>
          <p className="mt-3 text-sm text-slate-400">
            Operational access, member management, and organization setup.
          </p>
        </header>

        {/* Small, useful admin quick-actions to reduce friction for common tasks */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-6 gap-3">
          <Link
            href="/organization/members"
            className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            aria-label="View members"
            title="View and manage members"
          >
            View members
          </Link>

          <Link
            href="/organization/programming"
            className="mt-3 sm:mt-0 inline-flex items-center justify-center rounded-md border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            aria-label="Manage programming"
            title="Manage programming (schedules, classes, and workouts)"
            data-testid="manage-programming-link"
            aria-describedby="org-admin-quick-hint"
          >
            Manage programming
          </Link>

          {/* Small hint to guide admins when the page is empty - promoted to a subtle callout for clarity */}
          <div id="org-admin-quick-hint" className="mt-3 sm:mt-0 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2">
            {/* Increased hint contrast and slightly stronger background so the quick-tip is easier to read in bright rooms. */}
            <p className="text-sm text-slate-200">
              Tip: use the members page to invite, edit, or remove members. Check programming to manage schedules and classes.
            </p>
          </div>
        </div>
      </section>
    </SidebarShell>
  );
}
