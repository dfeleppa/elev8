import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserContext } from "@/lib/member";
import { garminMemberId } from "@/lib/garmin-personal";
import GarminDashboard from "@/components/health/GarminDashboard";

export default async function GarminPage() {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) redirect("/login");
  const memberId = garminMemberId();
  if (memberId ? memberId !== userId : role !== "owner") notFound();
  const configured = Boolean(memberId && process.env.GARMIN_PERSONAL_API_KEY?.trim());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 lg:px-8">
    <Link href="/member/athlete-dashboard" className="text-sm text-cyan-200">Back to athlete dashboard</Link>
    <header><p className="text-xs uppercase tracking-[0.3em] text-slate-400">Personal health</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">Garmin</h1>
      <p className="mt-2 text-sm text-slate-400">Your daily wellness, recovery, and activity data.</p>
    </header>
    {configured ? <GarminDashboard initialDate={today} /> : <section className="glass-panel rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-100">Finish connecting Garmin</h2>
      <p className="mt-2 text-sm text-slate-300">Set GARMIN_PERSONAL_API_KEY and GARMIN_PERSONAL_MEMBER_ID in this app’s Vercel environment, then redeploy. The member ID binds the connection to your login.</p>
      <p className="mt-3 break-all text-sm text-slate-400">Your Lyfe member ID: <code>{userId}</code></p>
    </section>}
  </main>;
}
