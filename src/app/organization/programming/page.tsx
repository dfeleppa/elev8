import Link from "next/link";
import SidebarShell from "../../../components/SidebarShell";

export default function OrganizationProgrammingPage() {
  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Programming</h1>
          <p className="mt-3 text-sm text-slate-400">Manage schedules, classes, and workouts for your organization.</p>
        </header>

        <div className="mt-6 rounded-md border border-slate-700 bg-slate-800/60 px-4 py-4">
          <p className="text-sm text-slate-200">
            This area will host programming tools: class schedules, recurring blocks, and workout templates.
            For now you can:
          </p>

          <ul className="mt-3 ml-5 list-disc text-sm text-slate-200">
            <li>
              Visit <Link href="/organization/members" className="text-sky-400 hover:underline">Members</Link> to invite or manage members.
            </li>
            <li className="mt-2">Create workout templates from the member workout page (coming soon).</li>
          </ul>

          <div className="mt-4">
            <Link
              href="/organization"
              className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Back to organization
            </Link>
          </div>
        </div>
      </section>
    </SidebarShell>
  );
}
