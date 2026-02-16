import SidebarShell from "../components/SidebarShell";

type TaskStatus = "in-progress" | "blocked" | "done";
type TaskPriority = "high" | "medium" | "low";

type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  due: string;
  priority: TaskPriority;
  tags: string[];
  progress: number;
};

const focusSignals = [
  {
    label: "Focus Hours",
    value: "4h 32m",
    delta: "+38% vs avg",
    accent: "from-sky-400/70 via-cyan-300/70 to-emerald-300/60",
  },
  {
    label: "Deep Work",
    value: "2 sessions",
    delta: "90 min protected",
    accent: "from-rose-400/70 via-orange-400/70 to-amber-300/60",
  },
  {
    label: "Energy",
    value: "78% steady",
    delta: "Sleep 7h 12m",
    accent: "from-violet-400/60 via-indigo-400/60 to-blue-300/60",
  },
];

const tasks: Task[] = [
  {
    id: 1,
    title: "Ship onboarding flow revamp",
    status: "in-progress",
    due: "09:30",
    priority: "high",
    tags: ["Product", "UX"],
    progress: 64,
  },
  {
    id: 2,
    title: "Synthesize customer insight scans",
    status: "blocked",
    due: "11:00",
    priority: "medium",
    tags: ["Research"],
    progress: 35,
  },
  {
    id: 3,
    title: "Prep fundraising weekly letter",
    status: "in-progress",
    due: "14:30",
    priority: "high",
    tags: ["Capital", "Narrative"],
    progress: 48,
  },
  {
    id: 4,
    title: "Ops sync with studio partners",
    status: "done",
    due: "16:00",
    priority: "low",
    tags: ["Ops"],
    progress: 100,
  },
];

const timeline = [
  {
    time: "08:00",
    title: "Calibrate Day",
    detail: "15-min clarity journal + quick intention note",
    tone: "text-cyan-200",
  },
  {
    time: "10:00",
    title: "Product Studio",
    detail: "Pair with Eden on activation tour",
    tone: "text-emerald-200",
  },
  {
    time: "13:00",
    title: "Focus Block",
    detail: "No meetings • mobile in flight mode",
    tone: "text-sky-200",
  },
  {
    time: "17:30",
    title: "Run Reset",
    detail: "5k tempo + hydration ritual",
    tone: "text-amber-200",
  },
];

const quickActions = [
  { label: "Log Win", helper: "15s" },
  { label: "Capture Idea", helper: "Cmd + Shift + K" },
  { label: "Flag Blocker", helper: "Routes ops" },
  { label: "Schedule Recharge", helper: "Auto slots" },
];

const rituals = [
  {
    label: "Morning calibration",
    detail: "Breathwork, daylight, plan pulse",
    score: 4,
  },
  {
    label: "Movement",
    detail: "3/4 sessions complete",
    score: 3,
  },
  {
    label: "Recovery",
    detail: "HRV trending ↑",
    score: 5,
  },
];

const habitMatrix = [
  { title: "Deep Work", values: [true, true, false, true, true, false, true] },
  { title: "Move 30+", values: [true, true, true, false, true, true, false] },
  { title: "Hydrate", values: [true, true, true, true, false, true, true] },
  { title: "Lights out <23", values: [false, true, true, true, true, false, true] },
];

const reflections = [
  {
    title: "Signal",
    body: "Momentum spike after simplifying research hand-off and batching context down to a single Loom.",
  },
  {
    title: "Blocker",
    body: "Waiting on finance sandbox access before we can model partner rev share scenarios.",
  },
];

const statusTone: Record<TaskStatus, string> = {
  "in-progress": "text-sky-300 bg-sky-300/10",
  blocked: "text-rose-300 bg-rose-300/10",
  done: "text-emerald-300 bg-emerald-300/10",
};

const priorityTone: Record<TaskPriority, string> = {
  high: "text-rose-300",
  medium: "text-amber-300",
  low: "text-slate-300",
};

export default function Home() {
  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(today);

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="relative overflow-hidden">
      <div className="gradient-haze orbital-glow pointer-events-none absolute left-10 top-0 h-72 w-72 rounded-full" />
      <div className="gradient-haze pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_55%)]" />

      <SidebarShell mainClassName="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1.6fr_1fr] lg:py-16">
        <section className="space-y-8">
          <header className="glass-panel card-fade-in rounded-[28px] border border-white/5 px-7 py-8 shadow-2xl" style={{ animationDelay: "0s" }}>
            <p className="text-sm uppercase tracking-[0.5em] text-slate-400">
              Elev8 cockpit
            </p>
            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm text-slate-400">{formattedDate}</p>
                <h1 className="mt-2 text-4xl font-semibold text-slate-50 sm:text-5xl">
                  Morning Systems Check
                </h1>
                <p className="mt-4 max-w-2xl text-slate-300">
                  Align execution, energy, and rituals in a single control center. Stay in flow, ship the
                  essentials, and protect the deep work windows you promised yourself.
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                {["Flow", "Build", "Recharge"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 px-4 py-2 text-slate-200 shadow-inner shadow-white/5"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="grid gap-5 md:grid-cols-3">
            {focusSignals.map((signal, idx) => (
              <div
                key={signal.label}
                className="glass-panel card-fade-in rounded-3xl border border-white/5 p-6"
                style={{ animationDelay: `${0.1 * (idx + 1)}s` }}
              >
                <p className="text-sm uppercase tracking-wide text-slate-400">{signal.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{signal.value}</p>
                <p className="mt-1 text-sm text-slate-400">{signal.delta}</p>
                <div className={`mt-6 h-1.5 rounded-full bg-gradient-to-r ${signal.accent}`} />
              </div>
            ))}
          </div>

          <section className="glass-panel rounded-[32px] border border-white/5 p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Mission Stack</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">Priority Tasks</h2>
              </div>
              <button className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-white/40">
                New Task
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4 ring-1 ring-white/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-slate-50">{task.title}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className={`rounded-full px-3 py-1 ${statusTone[task.status]}`}>
                          {task.status.replace("-", " ")}
                        </span>
                        {task.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-white/10 px-3 py-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${priorityTone[task.priority]}`}>{task.priority} priority</p>
                      <p className="text-xs text-slate-400">Due {task.due}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel rounded-[28px] border border-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Flow Map</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-50">Timeline</h3>
                </div>
                <span className="text-xs text-slate-400">TZ synced</span>
              </div>
              <div className="mt-6 space-y-5">
                {timeline.map((block) => (
                  <div key={block.time} className="flex gap-4">
                    <div className="text-sm font-medium text-slate-400">{block.time}</div>
                    <div>
                      <p className={`text-base font-semibold ${block.tone}`}>{block.title}</p>
                      <p className="text-sm text-slate-400">{block.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[28px] border border-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Ritual Pulse</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-50">Systems Health</h3>
                </div>
                <span className="text-xs text-slate-400">Scale ·5</span>
              </div>
              <div className="mt-6 space-y-4">
                {rituals.map((ritual) => (
                  <article key={ritual.label} className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-50">{ritual.label}</p>
                        <p className="text-sm text-slate-400">{ritual.detail}</p>
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-2.5 w-8 rounded-full ${
                              idx < ritual.score ? "bg-emerald-300" : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[28px] border border-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Quick Console</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-50">Actions</h3>
            <div className="mt-5 grid gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition-transform hover:-translate-y-0.5 hover:border-white/30"
                >
                  <span>{action.label}</span>
                  <span className="text-xs text-slate-400">{action.helper}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-[28px] border border-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Habits</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-50">Weekly grid</h3>
              </div>
              <div className="flex gap-2 text-[11px] text-slate-500">
                {weekdayLabels.map((day) => (
                  <span key={day}>{day.slice(0, 1)}</span>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {habitMatrix.map((habit) => (
                <div key={habit.title}>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                    <p>{habit.title}</p>
                    <p>
                      {habit.values.filter(Boolean).length}/{habit.values.length}
                    </p>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {habit.values.map((isComplete, idx) => (
                      <span
                        key={`${habit.title}-${idx}`}
                        className={`h-9 rounded-2xl border ${
                          isComplete
                            ? "border-emerald-400/60 bg-emerald-400/20"
                            : "border-white/5 bg-white/5"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-[28px] border border-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Notables</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-50">Signals + blockers</h3>
            <div className="mt-5 space-y-4">
              {reflections.map((entry) => (
                <article key={entry.title} className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.5em] text-slate-400">{entry.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{entry.body}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </SidebarShell>
    </div>
  );
}
