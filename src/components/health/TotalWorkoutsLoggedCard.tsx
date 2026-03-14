type TotalWorkoutsLoggedCardProps = {
  totalWorkouts: number;
};

function formatCount(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.trunc(value)));
}

export default function TotalWorkoutsLoggedCard({ totalWorkouts }: TotalWorkoutsLoggedCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Workouts Logged</p>
      <h2 className="mt-2 text-4xl font-semibold text-slate-900">{formatCount(totalWorkouts)}</h2>
      <p className="mt-1 text-sm text-slate-500">All workout result entries saved for your account.</p>
    </section>
  );
}
