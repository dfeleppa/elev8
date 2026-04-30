"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Bookmark,
  CalendarRange,
  Check,
  Image as ImageIcon,
  Mic,
  Pin,
  Plane,
  Reply,
  Sparkles,
  ThumbsUp,
  User as UserIcon,
  Utensils,
  Zap,
} from "lucide-react";
import clsx from "clsx";

import { Micro } from "@/components/ui";

type CoachMode = "human" | "hybrid" | "ai";

type ActionAttachment = {
  id: string;
  kind: "plan" | "suggest";
  label: string;
  detail?: string;
};

type MealAttachment = {
  kind: "meal" | "logged";
  title: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  items?: string[];
};

type Message = {
  id: number;
  from: "me" | "coach" | "ai";
  kind?: "human" | "ai";
  name?: string;
  time: string;
  text: string;
  actions?: ActionAttachment[];
  attachments?: MealAttachment[];
};

const INITIAL_THREAD: Message[] = [
  {
    id: 1,
    from: "coach",
    kind: "human",
    name: "Coach Lia",
    time: "Yesterday · 18:42",
    text: "Looked at your week — you're hitting protein but carbs ran light on training days. Let's add 30–40g around your sessions.",
    actions: [
      {
        id: "a1",
        kind: "plan",
        label: "Plan adjustment ready",
        detail: "+250 kcal · +40g carbs · pre-workout window",
      },
    ],
  },
  {
    id: 2,
    from: "me",
    time: "Yesterday · 19:10",
    text: "Makes sense. I felt flat on Thursday's Fran. What should I add?",
  },
  {
    id: 3,
    from: "coach",
    kind: "human",
    name: "Coach Lia",
    time: "Yesterday · 19:14",
    text: "Try a banana + 2 dates ~45 min before, plus a small whey shake. I've added two pre-workout templates to your plan.",
    attachments: [
      { kind: "meal", title: "Pre-WOD: Banana + dates", kcal: 230, p: 6, c: 50, f: 1 },
      { kind: "meal", title: "Pre-WOD: Oats & whey", kcal: 340, p: 28, c: 42, f: 6 },
    ],
  },
  {
    id: 4,
    from: "me",
    time: "Today · 09:02",
    text: "Logged breakfast — oats, whey, blueberries. How does it look?",
    attachments: [
      {
        kind: "logged",
        title: "Breakfast",
        kcal: 420,
        p: 34,
        c: 52,
        f: 9,
        items: ["Rolled oats 60g", "Whey isolate 30g", "Blueberries 80g", "Almond butter 10g"],
      },
    ],
  },
  {
    id: 5,
    from: "ai",
    kind: "ai",
    name: "Elev8 AI",
    time: "Today · 09:02",
    text: "Solid breakfast — protein is dialed and timing is good. You're on pace for 175g protein and 280g carbs today. Want me to suggest a lunch that keeps you on plan?",
    actions: [
      {
        id: "a2",
        kind: "suggest",
        label: "Suggest lunch (3 options)",
        detail: "Aligned with today's pull session",
      },
    ],
  },
];

const QUICK_PROMPTS = [
  { id: "q1", label: "Why did I crash mid-WOD?", icon: Zap },
  { id: "q2", label: "Suggest a high-protein lunch", icon: Utensils },
  { id: "q3", label: "Adjust plan for travel week", icon: Plane },
  { id: "q4", label: "Review my weekend", icon: CalendarRange },
];

export default function NutritionCoachClient() {
  const [thread, setThread] = useState<Message[]>(INITIAL_THREAD);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState<CoachMode>("ai");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const id = Date.now();
    setThread((prev) => [...prev, { id, from: "me", time: "Just now", text }]);
    setDraft("");
    setTyping(true);
    const useAI = mode === "ai" || mode === "hybrid";
    setTimeout(() => {
      setTyping(false);
      setThread((prev) => [
        ...prev,
        {
          id: id + 1,
          from: useAI ? "ai" : "coach",
          kind: useAI ? "ai" : "human",
          name: useAI ? "Elev8 AI" : "Coach Lia",
          time: "Just now",
          text: useAI
            ? "Got it — based on your last 3 sessions and today's plan, I'd lean toward a heavier carb lunch. Here are 3 options sized to your remaining macros."
            : "Thanks Mia, will get back to you in a bit. In the meantime try the suggestion I sent yesterday.",
        },
      ]);
    }, 1300);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-4rem)]">
      {/* Left: conversation */}
      <section
        className="col-span-1 lg:col-span-8 flex flex-col min-h-0 lg:border-r"
        style={{ borderColor: "var(--line)" }}
      >
        <ChatHeader mode={mode} setMode={setMode} />
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 lg:px-8 py-7">
          <ContextCard />
          <div className="space-y-6 mt-6">
            {thread.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            {typing && <TypingBubble />}
          </div>
        </div>
        <Composer draft={draft} setDraft={setDraft} send={send} />
      </section>

      {/* Right: context column */}
      <aside
        className="hidden lg:flex col-span-4 flex-col min-h-0 overflow-y-auto px-6 py-7 gap-4"
        style={{ background: "var(--bg-2)" }}
      >
        <CoachCard />
        <TodayMacrosCard />
        <CurrentPlanCard />
        <RecentLogsCard />
        <PinnedNotesCard />
      </aside>
    </div>
  );
}

function ChatHeader({ mode, setMode }: { mode: CoachMode; setMode: (m: CoachMode) => void }) {
  return (
    <div className="px-6 lg:px-8 pt-7 pb-5 border-b" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Micro className="mb-2">Nutrition coach</Micro>
          <h1 className="font-head font-semibold text-[28px] leading-[1.15] tracking-tight">
            Talk it through with Lia.
          </h1>
          <p
            className="mt-1 text-[13.5px] max-w-[520px]"
            style={{ color: "var(--text-muted)" }}
          >
            Ask anything about your plan, log meals for review, or get instant answers from Elev8 AI between coach replies.
          </p>
        </div>
        <ModeToggle mode={mode} setMode={setMode} />
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: CoachMode; setMode: (m: CoachMode) => void }) {
  const opts: { id: CoachMode; label: string; icon: typeof UserIcon; hint: string }[] = [
    { id: "human", label: "Coach", icon: UserIcon, hint: "Reply within 24h" },
    { id: "hybrid", label: "Hybrid", icon: Sparkles, hint: "AI now, coach later" },
    { id: "ai", label: "AI", icon: Sparkles, hint: "Instant" },
  ];
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-md"
      style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
    >
      {opts.map((o) => {
        const Icon = o.icon;
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setMode(o.id)}
            title={o.hint}
            className={clsx(
              "px-3 h-8 rounded text-[12px] font-medium inline-flex items-center gap-1.5 transition",
              !active && "opacity-65 hover:opacity-100",
            )}
            style={active ? { background: "var(--text)", color: "var(--bg)" } : undefined}
          >
            <Icon size={13} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ContextCard() {
  const stats = [
    { l: "Avg kcal", v: "2,140", sub: "target 2,180" },
    { l: "Avg protein", v: "168g", sub: "target 175g" },
    { l: "Adherence", v: "92%", sub: "last 7 days" },
    { l: "Weight", v: "−0.4kg", sub: "this week" },
  ];
  return (
    <div className="panel accent-pink-quiet p-5">
      <span className="micro" style={{ color: "var(--pink)" }}>Plan check-in</span>
      <div className="mt-2 flex items-baseline gap-3 flex-wrap">
        <div className="font-head font-semibold text-[18px] tracking-tight">
          Wk 3 of &ldquo;Lean cycle 2&rdquo; — on track
        </div>
        <span className="chip">4 days remaining</span>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.l}>
            <Micro>{s.l}</Micro>
            <div className="font-head font-semibold text-[15px] mt-0.5">{s.v}</div>
            <div className="font-mono text-[10.5px]" style={{ color: "var(--text-soft)" }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const mine = m.from === "me";
  if (mine) {
    return (
      <div className="flex items-start gap-3 justify-end fade-in">
        <div className="max-w-[78%]">
          <div
            className="font-mono text-[10px] mb-1.5 text-right"
            style={{ color: "var(--text-soft)" }}
          >
            {m.time}
          </div>
          <div
            className="px-4 py-3 rounded-md text-[13.5px] leading-[1.5]"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            {m.text}
          </div>
          {m.attachments && (
            <div className="mt-2 flex flex-col items-end gap-2">
              {m.attachments.map((a, i) => (
                <Attachment key={i} a={a} />
              ))}
            </div>
          )}
        </div>
        <div
          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
          style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
        >
          MA
        </div>
      </div>
    );
  }
  const isAI = m.kind === "ai";
  return (
    <div className="flex items-start gap-3 fade-in">
      <Avatar kind={m.kind} name={m.name} />
      <div className="max-w-[78%]">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-head font-semibold text-[13px]">{m.name}</span>
          {isAI ? (
            <span className="chip pill-violet">
              <Sparkles size={10} /> AI
            </span>
          ) : (
            <span className="chip pill-pink">
              <UserIcon size={10} /> Coach
            </span>
          )}
          <span className="font-mono text-[10px]" style={{ color: "var(--text-soft)" }}>
            {m.time}
          </span>
        </div>
        <div
          className="px-4 py-3 rounded-md text-[13.5px] leading-[1.55]"
          style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
        >
          {m.text}
          {m.actions && (
            <div
              className="mt-3 pt-3 border-t flex flex-wrap gap-2"
              style={{ borderColor: "var(--line)" }}
            >
              {m.actions.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-[12px]"
                  style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
                >
                  {a.kind === "plan" ? <CalendarRange size={13} /> : <Sparkles size={13} />}
                  <div>
                    <div className="font-medium">{a.label}</div>
                    {a.detail && (
                      <div
                        className="font-mono text-[10px]"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {a.detail}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ml-2 font-medium text-[11.5px]"
                    style={{ color: "var(--text)" }}
                  >
                    Apply →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {m.attachments && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {m.attachments.map((a, i) => (
              <Attachment key={i} a={a} />
            ))}
          </div>
        )}
        <div
          className="mt-2 flex items-center gap-3 text-[11px]"
          style={{ color: "var(--text-soft)" }}
        >
          <button type="button" className="inline-flex items-center gap-1 hover:text-[color:var(--text)]">
            <ThumbsUp size={12} /> Helpful
          </button>
          <button type="button" className="inline-flex items-center gap-1 hover:text-[color:var(--text)]">
            <Reply size={12} /> Reply
          </button>
          <button type="button" className="inline-flex items-center gap-1 hover:text-[color:var(--text)]">
            <Pin size={12} /> Pin
          </button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ kind, name }: { kind?: "human" | "ai"; name?: string }) {
  if (kind === "ai") {
    return (
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
        style={{
          background: "rgba(139,92,246,0.14)",
          border: "1px solid rgba(139,92,246,0.28)",
          color: "#b294f7",
        }}
      >
        <Sparkles size={14} />
      </div>
    );
  }
  const initials = name?.split(" ").map((w) => w[0]).slice(0, 2).join("") ?? "C";
  return (
    <div
      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
      style={{
        background: "rgba(255,74,141,0.10)",
        border: "1px solid rgba(255,74,141,0.25)",
        color: "var(--pink)",
      }}
    >
      {initials}
    </div>
  );
}

function Attachment({ a }: { a: MealAttachment }) {
  if (a.kind === "logged") {
    return (
      <div
        className="rounded-md text-[12.5px] p-3 max-w-[360px]"
        style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils size={13} />
            <span className="font-medium">{a.title}</span>
          </div>
          <span className="font-mono text-[11px]">{a.kcal} kcal</span>
        </div>
        <div
          className="mt-2 flex items-center gap-3 font-mono text-[10.5px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span>P {a.p}g</span>
          <span>C {a.c}g</span>
          <span>F {a.f}g</span>
        </div>
        {a.items && (
          <ul className="mt-2 space-y-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            {a.items.map((it, i) => (
              <li key={i}>· {it}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div
      className="rounded-md text-[12.5px] p-3"
      style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-2">
        <Bookmark size={13} className="opacity-70" />
        <span className="font-medium">{a.title}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-mono text-[10.5px]" style={{ color: "var(--text-muted)" }}>
          {a.kcal} kcal · P{a.p} C{a.c} F{a.f}
        </span>
        <button type="button" className="text-[11px] font-medium">
          Add to plan →
        </button>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-3">
      <Avatar kind="ai" name="Elev8 AI" />
      <div
        className="px-4 py-3 rounded-md"
        style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
      >
        <div className="ds-typing">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  send,
}: {
  draft: string;
  setDraft: (v: string) => void;
  send: (t: string) => void;
}) {
  return (
    <div
      className="border-t px-6 lg:px-8 pt-4 pb-6"
      style={{ borderColor: "var(--line)", background: "var(--bg)" }}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {QUICK_PROMPTS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => send(p.label)}
              className="chip hover:border-[color:var(--line-strong)]"
            >
              <Icon size={11} /> {p.label}
            </button>
          );
        })}
      </div>
      <div
        className="rounded-md p-3 flex items-end gap-3"
        style={{ background: "var(--panel)", border: "1px solid var(--line-strong)" }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          placeholder="Ask Lia or Elev8 AI… (Shift+Enter for newline)"
          rows={2}
          className="flex-1 bg-transparent outline-none resize-none text-[13.5px] leading-[1.5]"
          style={{ color: "var(--text)" }}
        />
        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          <button
            type="button"
            title="Attach meal"
            className="w-8 h-8 flex items-center justify-center rounded"
            style={{ color: "var(--text-muted)" }}
          >
            <Utensils size={16} />
          </button>
          <button
            type="button"
            title="Attach photo"
            className="w-8 h-8 flex items-center justify-center rounded"
            style={{ color: "var(--text-muted)" }}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            title="Voice"
            className="w-8 h-8 flex items-center justify-center rounded"
            style={{ color: "var(--text-muted)" }}
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            onClick={() => send(draft)}
            className="ml-1 px-3 h-8 rounded text-[12px] font-medium inline-flex items-center gap-1.5"
            style={{
              background: draft.trim() ? "var(--text)" : "var(--panel-2)",
              color: draft.trim() ? "var(--bg)" : "var(--text-muted)",
              border: "1px solid var(--line)",
            }}
          >
            Send <ArrowUp size={12} />
          </button>
        </div>
      </div>
      <div className="mt-2 font-mono text-[10px]" style={{ color: "var(--text-soft)" }}>
        Replies route by the toggle above · Coach replies usually within 24h · AI is instant
      </div>
    </div>
  );
}

/* ---- right column ---- */
function CoachCard() {
  return (
    <div className="panel hover-lift p-5">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-head font-semibold text-[14px]"
          style={{
            background: "rgba(255,74,141,0.10)",
            border: "1px solid rgba(255,74,141,0.25)",
            color: "var(--pink)",
          }}
        >
          LI
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight">Coach Lia I.</div>
          <div className="font-mono text-[10.5px]" style={{ color: "var(--text-soft)" }}>
            RD · 6 yrs · Elev8
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.55]" style={{ color: "var(--text-muted)" }}>
        Performance-focused dietitian. Specialises in CrossFit, Olympic lifting, and recomposition.
      </p>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="chip pill-lime">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#b6ff4a", display: "inline-block" }}
          />
          Online
        </span>
        <span className="chip">Replies in ~3h</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded text-[11.5px] font-medium"
          style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
        >
          Book a call
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded text-[11.5px] font-medium"
          style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
        >
          View bio
        </button>
      </div>
    </div>
  );
}

function TodayMacrosCard() {
  const macros = [
    { l: "Protein", cur: 142, tgt: 175 },
    { l: "Carbs", cur: 218, tgt: 280 },
    { l: "Fat", cur: 58, tgt: 70 },
  ];
  return (
    <div className="panel hover-lift p-5">
      <div className="flex items-center justify-between">
        <Micro>Today</Micro>
        <span className="font-mono text-[11px]">1,640 / 2,180 kcal</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {macros.map((m) => {
          const pct = Math.min(100, Math.round((m.cur / m.tgt) * 100));
          return (
            <div key={m.l}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span style={{ color: "var(--text-muted)" }}>{m.l}</span>
                <span className="font-mono">
                  {m.cur}
                  <span style={{ color: "var(--text-soft)" }}>/{m.tgt}g</span>
                </span>
              </div>
              <div
                className="mt-1 h-[3px] rounded-full"
                style={{ background: "var(--panel-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: "var(--text-muted)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurrentPlanCard() {
  return (
    <div className="panel hover-lift accent-violet-quiet p-5">
      <div className="flex items-center justify-between">
        <span className="micro" style={{ color: "var(--violet)" }}>Active plan</span>
        <span className="chip">v3 · Apr 14</span>
      </div>
      <div className="mt-1 font-head font-semibold text-[15px]">Lean cycle 2 — Wk 3 of 4</div>
      <ul className="mt-3 space-y-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <li>· 2,180 kcal · 175 P / 280 C / 70 F</li>
        <li>· +250 kcal pre-workout window</li>
        <li>· 3L water, 2g sodium</li>
      </ul>
      <button
        type="button"
        className="mt-3 w-full px-3 py-1.5 rounded text-[12px] font-medium"
        style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
      >
        Open plan →
      </button>
    </div>
  );
}

function RecentLogsCard() {
  const logs: { d: string; m: string; kcal: number; p: number; status: "ok" | "flag"; note?: string }[] = [
    { d: "Today", m: "Breakfast", kcal: 420, p: 34, status: "ok" },
    {
      d: "Yest.",
      m: "Dinner",
      kcal: 720,
      p: 52,
      status: "flag",
      note: "Carbs +15% over target",
    },
    { d: "Yest.", m: "Lunch", kcal: 540, p: 41, status: "ok" },
  ];
  return (
    <div className="panel hover-lift p-5">
      <div className="flex items-center justify-between">
        <Micro>Recent logs</Micro>
        <button type="button" className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          All →
        </button>
      </div>
      <div className="mt-2">
        {logs.map((l, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 text-[12.5px]"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
          >
            <div
              className="font-mono text-[10.5px] w-12 shrink-0"
              style={{ color: "var(--text-soft)" }}
            >
              {l.d}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{l.m}</div>
              {l.note && (
                <div className="text-[10.5px] mt-0.5" style={{ color: "#ffb347" }}>
                  {l.note}
                </div>
              )}
            </div>
            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              {l.kcal}
            </span>
            {l.status === "flag" ? (
              <span className="chip pill-amber">
                <AlertTriangle size={10} /> review
              </span>
            ) : (
              <span className="chip pill-lime">
                <Check size={10} /> ok
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PinnedNotesCard() {
  const notes = [
    "Eat within 60 min of waking — keeps cortisol in check.",
    "Carbs are not the enemy on training days. Protein every meal.",
    "Travel: pack jerky + dates + whey single-serves.",
  ];
  return (
    <div className="panel hover-lift p-5">
      <Micro className="mb-2">Pinned by Lia</Micro>
      <ul className="space-y-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        {notes.map((n, i) => (
          <li
            key={i}
            className="pl-3"
            style={{ borderLeft: "2px solid var(--line)" }}
          >
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
