import { redirect } from "next/navigation";
import Link from "next/link";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import MemberDetailClient from "./MemberDetailClient";

export default async function CoachNutritionMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/login");
  }

  const { memberId } = await params;

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-5xl px-5 py-10 lg:py-16">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Coach</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">Member Nutrition Detail</h1>
        </div>
        <Link
          href="/coach/nutrition-coach"
          className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← All Pending
        </Link>
      </header>

      <MemberDetailClient memberId={memberId} />
    </SidebarShell>
  );
}
