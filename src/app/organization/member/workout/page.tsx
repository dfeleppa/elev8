import Link from "next/link";
import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function MemberWorkoutPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Small breadcrumb improves navigation and reduces confusion about where you are */}
              <div className="mb-3">
                <Link href="/organization/member" className="text-sm text-slate-400 hover:text-slate-300">
                  ← Member
                </Link>
              </div>

              <h1 className="text-3xl font-semibold text-slate-100">Workout</h1>
              <p className="mt-3 text-sm text-slate-400">
                Plan workouts, track progress, and review training history.
              </p>
            </div>

            {/* Small, clear CTA so members know where to start - improves discoverability */}
            <div>
              <Link
                href="/organization/member/workout/create"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                aria-label="Create a new workout"
                data-testid="create-workout-button"
              >
                + Create Workout
              </Link>
            </div>
          </div>
        </header>

        {/* Helpful hint when the page is empty - reduces confusion */}
        <div className="rounded-md border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-300">
          Tip: Click "Create Workout" to add your first workout. You can add exercises, notes,
          and schedule it for a future date. Or <Link href="/organization/member/workout/create" className="text-indigo-400 hover:text-indigo-300 underline">create one now</Link>.
        </div>
      </section>
    </SidebarShell>
  );
}
