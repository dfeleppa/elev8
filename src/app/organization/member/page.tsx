import { redirect } from "next/navigation";

import Link from "next/link";
import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function OrganizationMemberPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Member</h1>
          <p className="mt-3 text-sm text-slate-400">
            Personal access, plans, and day-to-day team updates.
          </p>
        </header>

        {/* Small, useful member quick-actions to reduce friction for common tasks */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6">
          <Link
            href="/organization/member/workout"
            className="inline-flex items-center justify-center gap-3 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
            aria-label="View today's workout"
            aria-keyshortcuts="w"
            accessKey="w"
            title="Open today's workout (press W)"
            data-testid="todays-workout-button"
            aria-describedby="member-quick-hint"
          >
            {/* Show today's date to reduce ambiguity about which workout is opened */}
            {`Today's Workout — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`}
            <span className="sr-only">Opens today's workout for you</span>

            {/* Small visual hint for keyboard users; inexpensive UX improvement.
                Hide the KBD on very small screens to avoid wrapping the button text. */}
            <kbd className="hidden sm:inline-block rounded-sm border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 text-xs font-medium text-slate-100">W</kbd>
          </Link>

          <Link
            href="/organization/member/account-dashboard"
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            aria-label="Account and billing dashboard"
            title="View your account, subscriptions, and personal settings"
            data-testid="account-billing-button"
            aria-describedby="member-quick-hint"
          >
            Account & Billing
          </Link>

          {/* Small, clearer hint for members. Keep non-dismissible to stay simple for cron edits. */}
          <div id="member-quick-hint" className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2">
            <p className="text-sm text-slate-300">
              Tip: Open "Today's Workout" to start your session. Use Account to change details or manage billing.
            </p>
          </div>
        </div>
      </section>
    </SidebarShell>
  );
}
