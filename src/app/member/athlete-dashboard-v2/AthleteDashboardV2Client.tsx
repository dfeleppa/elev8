"use client";

import { useState } from "react";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Heart,
  MessageCircle,
  Plus,
  Search,
  TrendingDown,
  X,
} from "lucide-react";

import { AccentCard, Chip, Micro, Panel } from "@/components/ui";

type MealKey = "breakfast" | "lunch" | "snack" | "dinner";

type MealItem = {
  name: string;
  qty: string;
  cal: number;
  p: number;
  c: number;
  f: number;
};

type Meal = {
  key: MealKey;
  label: string;
  time: string;
  kcal: number;
  items: MealItem[];
  planned?: string;
};

const MEALS: Meal[] = [
  {
    key: "breakfast",
    label: "Breakfast",
    time: "7:10",
    kcal: 520,
    items: [
      { name: "Greek yogurt bowl", qty: "280 g", cal: 210, p: 22, c: 18, f: 6 },
      { name: "Banana", qty: "1 medium", cal: 105, p: 1, c: 27, f: 0 },
      { name: "Granola", qty: "40 g", cal: 180, p: 4, c: 30, f: 5 },
      { name: "Black coffee", qty: "1 cup", cal: 5, p: 0, c: 0, f: 0 },
    ],
  },
  {
    key: "lunch",
    label: "Lunch",
    time: "12:45",
    kcal: 640,
    items: [
      { name: "Chicken rice bowl", qty: "400 g", cal: 520, p: 42, c: 58, f: 12 },
      { name: "Side salad + olive oil", qty: "120 g", cal: 120, p: 2, c: 5, f: 10 },
    ],
  },
  {
    key: "snack",
    label: "Snack",
    time: "16:20",
    kcal: 220,
    items: [
      { name: "Protein shake", qty: "400 ml", cal: 180, p: 32, c: 8, f: 2 },
      { name: "Apple", qty: "1 medium", cal: 95, p: 0, c: 25, f: 0 },
    ],
  },
  {
    key: "dinner",
    label: "Dinner",
    time: "19:30",
    kcal: 0,
    items: [],
    planned: "Salmon · sweet potato · greens (~620 kcal target)",
  },
];

const WEEK: { d: string; cal: number | null; tgt: number; today?: boolean }[] = [
  { d: "Mon", cal: 2080, tgt: 2180 },
  { d: "Tue", cal: 2240, tgt: 2180 },
  { d: "Wed", cal: 1890, tgt: 2180 },
  { d: "Thu", cal: 2310, tgt: 2180 },
  { d: "Fri", cal: 2050, tgt: 2180 },
  { d: "Sat", cal: 1640, tgt: 2180, today: true },
  { d: "Sun", cal: null, tgt: 2180 },
];

const MEAL_CHIP_TONE: Record<MealKey, "pink" | "violet" | "lime" | "neutral"> = {
  breakfast: "pink",
  lunch: "violet",
  snack: "lime",
  dinner: "pink",
};

export default function AthleteDashboardV2Client() {
  const [day, setDay] = useState(5);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 max-w-[1360px] mx-auto">
      <HeroSection day={day} setDay={setDay} />

      <section className="fade-in mb-5 grid grid-cols-12 gap-5">
        <MacrosHero />
        <WaterCard />
        <GoalCard />
      </section>

      <section
        className="fade-in mb-5 grid grid-cols-12 gap-5"
        style={{ animationDelay: "120ms" }}
      >
        {MEALS.map((meal) => (
          <MealCard key={meal.key} meal={meal} />
        ))}
      </section>

      <section
        className="fade-in mb-5 grid grid-cols-12 gap-5"
        style={{ animationDelay: "180ms" }}
      >
        <CoachNovaCard />
        <WeekChart />
      </section>

      <section
        className="fade-in mb-10 grid grid-cols-12 gap-5"
        style={{ animationDelay: "240ms" }}
      >
        <Micronutrients />
        <FoodLibrary />
      </section>
    </div>
  );
}

function HeroSection({ day, setDay }: { day: number; setDay: (n: number) => void }) {
  return (
    <section className="fade-in mb-10 flex items-end justify-between gap-6 flex-wrap">
      <div>
        <div className="micro mb-3 flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: "var(--lime)" }}
          />
          540 kcal under target · time to fuel
        </div>
        <h1 className="font-head font-semibold text-[40px] sm:text-[48px] lg:text-[56px] leading-[1.02] tracking-tight max-w-[820px]">
          Eat like an athlete.{" "}
          <span style={{ color: "var(--text-muted)" }}>
            Dinner is <span style={{ color: "var(--text)" }}>still ahead</span>.
          </span>
        </h1>
        <p
          className="mt-3 text-[15px] max-w-[640px]"
          style={{ color: "var(--text-muted)" }}
        >
          You&apos;re hitting protein nicely, carbs are on track, and fat is a touch low.
          Your coach suggests a 40/60 post-lift shake before dinner.
        </p>
      </div>
      <DaySwitcher day={day} setDay={setDay} />
    </section>
  );
}

function DaySwitcher({ day, setDay }: { day: number; setDay: (n: number) => void }) {
  const days = WEEK.map((w) => w.d);
  return (
    <div
      className="flex items-center gap-1.5 p-1 rounded-md"
      style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
    >
      <button
        type="button"
        className="w-7 h-7 flex items-center justify-center rounded"
        onClick={() => setDay(Math.max(0, day - 1))}
        aria-label="Previous day"
      >
        <ChevronLeft size={16} />
      </button>
      {days.map((d, i) => (
        <button
          key={d}
          type="button"
          onClick={() => setDay(i)}
          className={
            "px-3 h-7 rounded text-[12px] font-head font-semibold " +
            (i === day ? "" : "opacity-60 hover:opacity-100")
          }
          style={i === day ? { background: "var(--text)", color: "var(--bg)" } : {}}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        className="w-7 h-7 flex items-center justify-center rounded"
        onClick={() => setDay(Math.min(6, day + 1))}
        aria-label="Next day"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function MacrosHero() {
  const cal = { cur: 1640, tgt: 2180 };
  const pct = Math.round((cal.cur / cal.tgt) * 100);
  const r = 66;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - cal.cur / cal.tgt);
  const macros = [
    { label: "Protein", cur: 142, tgt: 175, unit: "g" },
    { label: "Carbs", cur: 218, tgt: 280, unit: "g" },
    { label: "Fat", cur: 58, tgt: 70, unit: "g" },
    { label: "Fiber", cur: 24, tgt: 35, unit: "g" },
  ];

  return (
    <AccentCard tone="pink" className="col-span-12 md:col-span-7 !p-7">
      <div className="relative flex items-start justify-between">
        <div>
          <Micro onAccent as="p">Today · Saturday</Micro>
          <div className="mt-1 font-head font-semibold text-[15px] opacity-80">
            Training day · Pull block
          </div>
        </div>
        <span
          className="chip"
          style={{
            background: "rgba(35,0,18,0.12)",
            color: "#230012",
            borderColor: "rgba(35,0,18,0.2)",
          }}
        >
          <TrendingDown size={13} /> 540 kcal to go
        </span>
      </div>

      <div className="relative mt-6 flex items-center gap-8 flex-wrap">
        <div className="relative w-[168px] h-[168px] shrink-0">
          <svg viewBox="0 0 160 160" width="168" height="168">
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke="rgba(35,0,18,0.18)"
              strokeWidth="12"
            />
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke="#230012"
              strokeWidth="12"
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
              strokeDasharray={circ}
              strokeDashoffset={off}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-head font-bold text-[46px] leading-none">
              {cal.cur.toLocaleString()}
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-widest opacity-75 mt-1">
              of {cal.tgt.toLocaleString()} kcal
            </div>
            <div
              className="mt-1 font-mono text-[11px] font-semibold"
              style={{ color: "#230012" }}
            >
              {pct}%
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[260px] grid grid-cols-2 gap-x-6 gap-y-4">
          {macros.map((m) => {
            const mp = Math.round((m.cur / m.tgt) * 100);
            return (
              <div key={m.label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] opacity-85 font-medium">{m.label}</span>
                  <span className="font-mono text-[12px] font-semibold">
                    {m.cur}
                    <span className="opacity-70">
                      /{m.tgt}
                      {m.unit}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 rounded-full"
                  style={{ background: "rgba(35,0,18,0.16)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: Math.min(100, mp) + "%",
                      background: "#230012",
                    }}
                  />
                </div>
                <div className="mt-0.5 font-mono text-[10px] opacity-65">{mp}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </AccentCard>
  );
}

function WaterCard() {
  const cur = 5;
  const tgt = 8;
  return (
    <AccentCard
      tone="violet"
      className="col-span-12 md:col-span-3 !p-6 flex flex-col"
    >
      <div className="relative">
        <Micro onAccent as="p">Hydration</Micro>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-head font-bold text-[44px] leading-none">{cur}</span>
          <span className="font-mono text-[11px] opacity-75">of {tgt} glasses</span>
        </div>
      </div>
      <div className="relative mt-5 flex gap-1.5 flex-1 min-h-[60px]">
        {Array.from({ length: tgt }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm relative overflow-hidden"
            style={{ background: "rgba(20,10,46,0.2)" }}
          >
            {i < cur && (
              <div
                className="absolute inset-0 bar-grow"
                style={{ background: "#140a2e", animationDelay: i * 60 + "ms" }}
              />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="relative mt-5 inline-flex items-center justify-center gap-2 py-2 rounded-md font-head font-semibold text-[12.5px] transition hover:opacity-90"
        style={{ background: "#140a2e", color: "#c4b5fd" }}
      >
        <Droplet size={14} /> Log a glass
      </button>
    </AccentCard>
  );
}

function GoalCard() {
  return (
    <Panel className="col-span-12 md:col-span-2 hover-lift flex flex-col">
      <Micro>Goal</Micro>
      <div className="mt-1 font-head font-semibold text-[15px]">Performance</div>
      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className="font-head font-bold text-[28px] tracking-tight">68.4</span>
          <span
            className="font-mono text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            kg
          </span>
        </div>
        <div
          className="text-[11px] font-mono font-semibold"
          style={{ color: "var(--pink)" }}
        >
          −1.8 in 8 wk
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-[var(--line)]">
        <Micro>Next check-in</Micro>
        <div className="text-[13px] font-head font-semibold mt-0.5">Tue, Apr 21</div>
      </div>
    </Panel>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const isEmpty = meal.items.length === 0;
  return (
    <Panel className="col-span-12 md:col-span-6 xl:col-span-3 hover-lift flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Chip tone={MEAL_CHIP_TONE[meal.key]}>{meal.label}</Chip>
          <span
            className="font-mono text-[10.5px]"
            style={{ color: "var(--text-soft)" }}
          >
            {meal.time}
          </span>
        </div>
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center rounded hover-lift"
          style={{ color: "var(--text-muted)" }}
          aria-label={`Add to ${meal.label.toLowerCase()}`}
        >
          <Plus size={16} />
        </button>
      </div>

      {!isEmpty ? (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-head font-bold text-[26px] tracking-tight">
              {meal.kcal}
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              kcal
            </span>
          </div>
          <div className="mt-3 space-y-1.5 flex-1">
            {meal.items.map((it, i) => (
              <div
                key={it.name}
                className="flex items-center justify-between py-1.5"
                style={{
                  borderBottom:
                    i === meal.items.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{it.name}</div>
                  <div
                    className="font-mono text-[10px]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {it.qty}
                  </div>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <div className="font-mono text-[11.5px] font-semibold">{it.cal}</div>
                  <div
                    className="font-mono text-[9.5px]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    P{it.p} · C{it.c} · F{it.f}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 flex-1 flex flex-col">
          <Micro>Planned</Micro>
          <div
            className="text-[13px] mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {meal.planned}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center gap-1 py-2 rounded-md font-head font-semibold text-[12px] border border-[var(--line)] hover-lift"
            style={{ background: "var(--panel-2)" }}
          >
            <Plus size={13} /> Log {meal.label.toLowerCase()}
          </button>
        </div>
      )}
    </Panel>
  );
}

function CoachNovaCard() {
  return (
    <AccentCard tone="lime" className="col-span-12 md:col-span-5 !p-7">
      <div className="relative flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#14220a", color: "var(--lime)" }}
        >
          <Brain size={22} />
        </div>
        <div>
          <Micro onAccent as="p">Coach Nova · 2 min ago</Micro>
          <div className="mt-1 font-head font-semibold text-[22px] leading-[1.2]">
            Fat is 12g low. Add 1 tbsp olive oil to your salad tonight.
          </div>
        </div>
      </div>
      <p className="relative mt-3 text-[13.5px] leading-[1.55] max-w-[540px] opacity-85">
        You&apos;re tracking well on protein and carbs today. One tablespoon brings your
        fat to 70g and adds the satiety that keeps your evening snacks in check — and
        boosts absorption of vitamins A, D, E, K from the greens.
      </p>
      <div className="relative mt-5 flex items-center gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded-md font-head font-semibold text-[12.5px] transition hover:opacity-90"
          style={{ background: "#14220a", color: "var(--lime)" }}
        >
          Apply to dinner
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-4 py-2 rounded-md font-head font-semibold text-[12.5px]"
          style={{
            background: "rgba(20,34,10,0.15)",
            color: "#14220a",
            border: "1px solid rgba(20,34,10,0.25)",
          }}
        >
          <MessageCircle size={12} /> Ask Nova
        </button>
        <button
          type="button"
          className="ml-auto px-2 py-2 rounded-md"
          style={{ color: "#14220a", opacity: 0.6 }}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </AccentCard>
  );
}

function WeekChart() {
  const values = WEEK.filter((w) => w.cal != null).map((w) => w.cal as number);
  const maxVal = Math.max(...values, 2400);
  return (
    <Panel padding="lg" className="col-span-12 md:col-span-7 hover-lift">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Micro>This week · kcal vs target</Micro>
          <h3 className="mt-0.5 font-head font-semibold text-[20px]">
            Pretty solid run
          </h3>
          <p
            className="text-[12.5px] mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Avg 2,035 kcal · hit target 3/6 days · under by 145 kcal on avg
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["Kcal", "Protein", "Carbs", "Fat"].map((t, i) => (
            <button
              key={t}
              type="button"
              className={
                "px-3 py-1.5 rounded-md text-[12px] font-head font-semibold " +
                (i === 0 ? "" : "opacity-60 hover:opacity-100")
              }
              style={
                i === 0
                  ? {
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                    }
                  : {}
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7 relative h-[180px] flex items-end gap-3">
        <div
          className="absolute left-0 right-0 border-t border-dashed"
          style={{
            bottom: (2180 / maxVal) * 160 + "px",
            borderColor: "rgba(255,74,141,0.5)",
          }}
        >
          <span
            className="absolute -top-5 right-0 font-mono text-[10px] font-semibold"
            style={{ color: "var(--pink)" }}
          >
            Target 2,180
          </span>
        </div>
        {WEEK.map((w, i) => {
          const h = w.cal == null ? 0 : (w.cal / maxVal) * 160;
          const over = w.cal != null && w.cal > w.tgt;
          return (
            <div key={w.d} className="flex-1 flex flex-col items-center gap-2">
              <div className="relative flex flex-col items-center justify-end w-full h-[160px]">
                {w.cal == null ? (
                  <div
                    className="w-full h-full border border-dashed rounded-[3px]"
                    style={{ borderColor: "var(--line-strong)" }}
                  />
                ) : (
                  <div
                    className="w-full rounded-[3px] bar-grow"
                    style={{
                      height: h + "px",
                      background: w.today
                        ? "linear-gradient(180deg, var(--pink), var(--violet))"
                        : over
                          ? "rgba(255,74,141,0.35)"
                          : "var(--panel-2)",
                      border:
                        w.today || over ? "none" : "1px solid var(--line)",
                      animationDelay: i * 60 + "ms",
                    }}
                  />
                )}
              </div>
              <div className="text-center">
                <div
                  className={
                    "font-head font-semibold text-[12px] " +
                    (w.today ? "text-[color:var(--text)]" : "")
                  }
                >
                  {w.d}
                </div>
                <div
                  className="font-mono text-[9.5px]"
                  style={{ color: "var(--text-soft)" }}
                >
                  {w.cal ? w.cal.toLocaleString() : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Micronutrients() {
  const rows: { label: string; cur: number; tgt: number; unit: string; reverse?: boolean }[] = [
    { label: "Fiber", cur: 24, tgt: 35, unit: "g" },
    { label: "Sugar", cur: 62, tgt: 50, unit: "g", reverse: true },
    { label: "Saturated fat", cur: 12, tgt: 22, unit: "g" },
    { label: "Sodium", cur: 1840, tgt: 2300, unit: "mg" },
    { label: "Iron", cur: 11, tgt: 18, unit: "mg" },
    { label: "Calcium", cur: 780, tgt: 1000, unit: "mg" },
  ];
  return (
    <Panel padding="lg" className="col-span-12 md:col-span-5 hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <Micro>Micros · Today</Micro>
          <h3 className="mt-0.5 font-head font-semibold text-[18px]">Quality check</h3>
        </div>
        <Chip tone="violet">6 tracked</Chip>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r) => {
          const pct = Math.min(100, Math.round((r.cur / r.tgt) * 100));
          const over = r.reverse && r.cur > r.tgt;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium">{r.label}</span>
                <span
                  className="font-mono text-[11.5px]"
                  style={{ color: over ? "var(--pink)" : "var(--text-muted)" }}
                >
                  {r.cur}
                  <span style={{ color: "var(--text-soft)" }}>
                    /{r.tgt}
                    {r.unit}
                  </span>
                </span>
              </div>
              <div
                className="mt-1 h-1.5 rounded-full"
                style={{ background: "var(--panel-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: pct + "%",
                    background: over
                      ? "var(--pink)"
                      : "linear-gradient(90deg, var(--violet), var(--lime))",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function FoodLibrary() {
  const foods = [
    { name: "Greek yogurt bowl", cat: "Breakfast", cal: 210, p: 22, c: 18, f: 6, fav: true },
    { name: "Chicken rice bowl", cat: "Lunch", cal: 520, p: 42, c: 58, f: 12, fav: true },
    { name: "Protein shake", cat: "Snack", cal: 180, p: 32, c: 8, f: 2, fav: true },
    { name: "Salmon + sweet potato", cat: "Dinner", cal: 620, p: 48, c: 52, f: 20, fav: false },
    { name: "Oats + berries", cat: "Breakfast", cal: 340, p: 12, c: 58, f: 6, fav: false },
    { name: "Turkey wrap", cat: "Lunch", cal: 440, p: 32, c: 42, f: 14, fav: false },
  ];
  return (
    <Panel padding="none" className="col-span-12 md:col-span-7 overflow-hidden hover-lift flex flex-col">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--line)]">
        <div>
          <Micro>Your library</Micro>
          <h3 className="mt-0.5 font-head font-semibold text-[18px]">
            Quick add from favorites
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md"
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
            }}
          >
            <Search size={14} className="opacity-60" />
            <input
              placeholder="Search 1,240 foods"
              className="bg-transparent outline-none text-[12.5px] w-48"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-head font-semibold"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            <Plus size={13} /> New food
          </button>
        </div>
      </div>
      <div>
        {foods.map((f, i) => (
          <div
            key={f.name}
            className="flex items-center gap-4 px-6 py-3 hover-lift"
            style={{
              background: i % 2 ? "var(--panel-2)" : "transparent",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              aria-label={f.fav ? "Unfavorite" : "Favorite"}
            >
              <Heart size={16} fill={f.fav ? "currentColor" : "none"} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold truncate">{f.name}</div>
              <div
                className="font-mono text-[10.5px]"
                style={{ color: "var(--text-soft)" }}
              >
                {f.cat}
              </div>
            </div>
            <div
              className="hidden md:block font-mono text-[11px] text-right min-w-[140px]"
              style={{ color: "var(--text-muted)" }}
            >
              P{f.p} · C{f.c} · F{f.f}
            </div>
            <div className="font-head font-semibold text-[14px] min-w-[60px] text-right">
              {f.cal}
              <span className="font-mono text-[10px] opacity-60"> kcal</span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-head font-semibold"
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
              }}
            >
              <Plus size={13} /> Log
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
