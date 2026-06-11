import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";

export default async function MemberNutritionCoachPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }
  if (isMemberRouteLocked(role, "/member/nutrition-coach")) {
    redirect("/member/nutrition");
  }

  return (
    <div className="w-full">
      <section className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-5 lg:px-10 lg:py-10">
        <header>
          <h1 className="text-[34px] font-bold leading-none tracking-[-0.03em] text-slate-950 lg:text-3xl lg:font-semibold lg:tracking-normal lg:text-[var(--text)]">AI Coach</h1>
          <p className="mt-3 text-sm font-medium text-slate-500 lg:text-[var(--text-muted)]">Coming Soon.</p>
        </header>

        <div className="rounded-[28px] border border-white/80 bg-white/60 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_24px_58px_rgba(79,102,124,0.14)] backdrop-blur-2xl lg:rounded-[10px] lg:border-[var(--line)] lg:bg-[var(--panel)] lg:p-10 lg:shadow-[var(--shadow-md)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 lg:text-[var(--text-soft)]">Nutrition Coach</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-slate-950 lg:text-[var(--text)]">Coming Soon</h2>
          <p className="mx-auto mt-3 max-w-md text-sm font-medium text-slate-500 lg:text-[var(--text-muted)]">
            This coaching workspace is being rebuilt. No chat, automation, or plan actions are active here right now.
          </p>
        </div>
      </section>
    </div>
  );
}
