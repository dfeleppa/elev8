import { redirect } from "next/navigation";
import Link from "next/link";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

import NutritionTopBar from "../NutritionTopBar";
import CoachPlanClient from "./CoachPlanClient";

export default async function MemberNutritionCoachPlanPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <section className="mx-auto w-full max-w-[1480px] space-y-5 px-4 py-5 lg:space-y-8 lg:px-10 lg:py-10">
        <header className="lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Nutrition</p>
              <h1 className="mt-1 text-[34px] font-bold leading-none tracking-[-0.03em] text-slate-950">Plan</h1>
              <p className="mt-2 text-[14px] font-medium text-slate-500">Check in, review macros, and stay aligned.</p>
            </div>
          </div>

          <nav className="mt-4 grid grid-cols-3 rounded-full border border-white/80 bg-white/70 p-1 text-center text-xs font-bold shadow-[0_14px_28px_rgba(73,99,126,0.1)] backdrop-blur-xl">
            {[
              { label: "Daily", href: "/member/nutrition", active: false },
              { label: "Plan", href: "/member/nutrition/coach", active: true },
              { label: "AI Coach", href: "/member/nutrition-coach", active: false },
            ].map((tabItem) => (
              <Link
                key={tabItem.href}
                href={tabItem.href}
                className={`rounded-full px-2 py-2 transition ${
                  tabItem.active
                    ? "bg-[#23d1df] text-white shadow-[0_8px_18px_rgba(35,209,223,0.28)]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tabItem.label}
              </Link>
            ))}
          </nav>
        </header>

        <header className="hidden lg:block">
          <h1 className="text-3xl font-semibold text-[var(--text)]">Plan</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Review your assigned nutrition plan, weekly check-ins, and progress notes.
          </p>
          <div className="mt-4">
            <NutritionTopBar active="coach" />
          </div>
        </header>

        <CoachPlanClient />
      </section>
    </SidebarShell>
  );
}
