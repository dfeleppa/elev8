import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const statUnitMap: Record<string, string> = {
  body_weight: "lb",
  body_fat: "%",
  lean_body_mass: "lb",
  back_squat: "lb",
  front_squat: "lb",
  overhead_squat: "lb",
  bench_press: "lb",
  deadlift: "lb",
  strict_press: "lb",
  clean: "lb",
  clean_jerk: "lb",
  snatch: "lb",
  weighted_pullup: "lb",
  weighted_dip: "lb",
  max_pullups: "reps",
  max_toes_to_bar: "reps",
  max_dips: "reps",
  running: "min",
  rowing: "min",
  biking: "min",
  crossfit: "min",
};

// Maps lowercase movement names (from movement_library) to strength stat keys
const movementNameToStatKey: Record<string, string> = {
  "squat": "back_squat",
  "back squat": "back_squat",
  "back squats": "back_squat",
  "front squat": "front_squat",
  "front squats": "front_squat",
  "overhead squat": "overhead_squat",
  "overhead squats": "overhead_squat",
  "ohs": "overhead_squat",
  "bench": "bench_press",
  "bench press": "bench_press",
  "deadlift": "deadlift",
  "conventional deadlift": "deadlift",
  "sumo deadlift": "deadlift",
  "press": "strict_press",
  "shoulder press": "strict_press",
  "overhead press": "strict_press",
  "strict press": "strict_press",
  "clean": "clean",
  "power clean": "clean",
  "clean & jerk": "clean_jerk",
  "clean and jerk": "clean_jerk",
  "snatch": "snatch",
  "power snatch": "snatch",
  "weighted pullup": "weighted_pullup",
  "weighted pull-up": "weighted_pullup",
  "weighted pull up": "weighted_pullup",
  "weighted dip": "weighted_dip",
  "weighted dips": "weighted_dip",
};

// Maps lowercase movement names to reps-based stat keys (uses best_reps from PRs)
const movementNameToRepsStatKey: Record<string, string> = {
  "pullup": "max_pullups",
  "pull-up": "max_pullups",
  "pullups": "max_pullups",
  "pull-ups": "max_pullups",
  "toes to bar": "max_toes_to_bar",
  "toes-to-bar": "max_toes_to_bar",
  "ttb": "max_toes_to_bar",
  "dip": "max_dips",
  "dips": "max_dips",
};

type PrRow = {
  best_weight: number | null;
  best_reps: number | null;
  recorded_at: string | null;
  movement_library: { name: string | null } | Array<{ name: string | null }> | null;
};

export async function GET() {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const [statsResult, prsResult] = await Promise.all([
    supabaseAdmin
      .from("health_stat_entries")
      .select("stat_key, value, unit, entry_date")
      .eq("member_id", userId)
      .order("entry_date", { ascending: false }),
    supabaseAdmin
      .from("member_movement_prs")
      .select("best_weight, best_reps, recorded_at, movement_library(name)")
      .eq("member_id", userId),
  ]);

  if (statsResult.error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const latest: Record<string, { value: string; unit: string; entryDate: string | null }> = {};

  (statsResult.data ?? []).forEach((row) => {
    if (!row?.stat_key || latest[row.stat_key]) {
      return;
    }
    latest[row.stat_key] = {
      value: row.value?.toString?.() ?? "",
      unit: row.unit ?? statUnitMap[row.stat_key] ?? "",
      entryDate: row.entry_date ?? null,
    };
  });

  // Overlay strength stats with best weights from workout history
  (prsResult.data ?? []).forEach((row) => {
    const pr = row as unknown as PrRow;
    if (!pr.best_weight) return;
    const movement = Array.isArray(pr.movement_library)
      ? pr.movement_library[0]
      : pr.movement_library;
    const movementName = movement?.name?.toLowerCase().trim() ?? "";
    const statKey = movementNameToStatKey[movementName];
    if (!statKey) return;

    const existing = latest[statKey];
    const prWeight = pr.best_weight;
    const existingWeight = Number(existing?.value ?? 0);

    if (!existing || prWeight > existingWeight) {
      latest[statKey] = {
        value: prWeight.toString(),
        unit: "lb",
        entryDate: pr.recorded_at ?? null,
      };
    }
  });

  // Overlay reps-based gymnastics stats from workout history
  (prsResult.data ?? []).forEach((row) => {
    const pr = row as unknown as PrRow;
    if (!pr.best_reps) return;
    const movement = Array.isArray(pr.movement_library)
      ? pr.movement_library[0]
      : pr.movement_library;
    const movementName = movement?.name?.toLowerCase().trim() ?? "";
    const statKey = movementNameToRepsStatKey[movementName];
    if (!statKey) return;

    const existing = latest[statKey];
    const prReps = pr.best_reps;
    const existingReps = Number(existing?.value ?? 0);

    if (!existing || prReps > existingReps) {
      latest[statKey] = {
        value: prReps.toString(),
        unit: "reps",
        entryDate: pr.recorded_at ?? null,
      };
    }
  });

  // Compute derived totals from individual lift PRs
  const backSquat = Number(latest["back_squat"]?.value ?? 0);
  const benchPress = Number(latest["bench_press"]?.value ?? 0);
  const deadlift = Number(latest["deadlift"]?.value ?? 0);
  const strictPress = Number(latest["strict_press"]?.value ?? 0);
  const cleanJerk = Number(latest["clean_jerk"]?.value ?? 0);
  const snatch = Number(latest["snatch"]?.value ?? 0);

  const powerliftingTotal = backSquat + benchPress + deadlift;
  const crossfitTotal = backSquat + deadlift + strictPress;
  const olympicTotal = cleanJerk + snatch;

  if (powerliftingTotal > 0) {
    latest["powerlifting_total"] = { value: String(powerliftingTotal), unit: "lb", entryDate: null };
  }
  if (crossfitTotal > 0) {
    latest["crossfit_total"] = { value: String(crossfitTotal), unit: "lb", entryDate: null };
  }
  if (olympicTotal > 0) {
    latest["olympic_total"] = { value: String(olympicTotal), unit: "lb", entryDate: null };
  }

  return NextResponse.json({ stats: latest });
}

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "log_body_comp") {
    return handleLogBodyComp(userId, body);
  }

  const statKey = typeof body?.statKey === "string" ? body.statKey : "";
  const unit = statUnitMap[statKey];
  const numericValue = Number(body?.value);

  if (!statKey || !unit || !Number.isFinite(numericValue)) {
    return NextResponse.json({ error: "Invalid stat payload." }, { status: 400 });
  }

  const entryDate = new Date().toISOString().slice(0, 10);

  const { data, error: insertError } = await supabaseAdmin
    .from("health_stat_entries")
    .insert({
      member_id: userId,
      stat_key: statKey,
      value: numericValue,
      unit,
      entry_date: entryDate,
      updated_at: new Date().toISOString(),
    })
    .select("stat_key, value, unit, entry_date")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({
    entry: {
      statKey: data.stat_key,
      value: data.value,
      unit: data.unit,
      entryDate: data.entry_date,
    },
  });
}

async function handleLogBodyComp(userId: string, body: unknown) {
  const req = body as Record<string, unknown>;
  const bodyWeight = Number(req.bodyWeight);
  const bodyFatPercent = Number(req.bodyFatPercent);
  const entryDate = new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(bodyWeight) || bodyWeight <= 0) {
    return NextResponse.json({ error: "Body weight is required and must be positive." }, { status: 400 });
  }

  const inserts: Array<{
    member_id: string;
    stat_key: string;
    value: number;
    unit: string;
    entry_date: string;
    updated_at: string;
  }> = [
    {
      member_id: userId,
      stat_key: "body_weight",
      value: bodyWeight,
      unit: "lb",
      entry_date: entryDate,
      updated_at: new Date().toISOString(),
    },
  ];

  if (Number.isFinite(bodyFatPercent) && bodyFatPercent > 0 && bodyFatPercent < 100) {
    const leanBodyMass = bodyWeight * (1 - bodyFatPercent / 100);
    inserts.push({
      member_id: userId,
      stat_key: "body_fat",
      value: bodyFatPercent,
      unit: "%",
      entry_date: entryDate,
      updated_at: new Date().toISOString(),
    });
    inserts.push({
      member_id: userId,
      stat_key: "lean_body_mass",
      value: Math.round(leanBodyMass * 10) / 10,
      unit: "lb",
      entry_date: entryDate,
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("health_stat_entries")
    .insert(inserts)
    .select("stat_key, value, unit, entry_date");

  if (insertError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const entries: Record<string, { value: string; unit: string; entryDate: string | null }> = {};
  (data ?? []).forEach((row) => {
    entries[row.stat_key] = {
      value: row.value?.toString?.() ?? "",
      unit: row.unit ?? "",
      entryDate: row.entry_date ?? null,
    };
  });

  return NextResponse.json({ entries, entryDate });
}
