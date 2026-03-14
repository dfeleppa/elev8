#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const MEAL_MAP = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

async function loadEnvLocal() {
  try {
    const text = await fs.readFile(".env.local", "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const index = line.indexOf("=");
      if (index === -1) {
        continue;
      }
      const key = line.slice(0, index).trim();
      const raw = line.slice(index + 1).trim();
      const value = raw.replace(/^"|"$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional.
  }
}

function toOptionalDecimal(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, parsed);
}

function toPositiveDecimal(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(0.01, parsed);
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function resolveMemberId(supabase, args) {
  if (args["member-id"]) {
    return String(args["member-id"]).trim();
  }

  const email = args.email ? String(args.email).trim().toLowerCase() : "";
  if (email) {
    const { data, error } = await supabase
      .from("app_users")
      .select("id,email")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve app user by email: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error(`No app user found for email '${email}'.`);
    }

    return data.id;
  }

  throw new Error("Provide --email <address> or --member-id <uuid>.");
}

async function ensureCustomFoods(supabase, memberId, foods, dryRun) {
  const mineFoods = foods.filter((food) => String(food.source ?? "").toLowerCase() === "mine");

  const { data: existingRows, error: existingError } = await supabase
    .from("nutrition_custom_foods")
    .select("id,name")
    .eq("member_id", memberId);

  if (existingError) {
    throw new Error(`Unable to read existing custom foods: ${existingError.message}`);
  }

  const existingByName = new Map((existingRows ?? []).map((row) => [String(row.name).trim().toLowerCase(), row]));

  const toInsert = [];
  for (const food of mineFoods) {
    const name = String(food.name ?? "").trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (existingByName.has(key)) {
      continue;
    }
    toInsert.push({
      member_id: memberId,
      name,
      calories: toOptionalDecimal(food.calories),
      protein: toOptionalDecimal(food.protein),
      carbs: toOptionalDecimal(food.carbs),
      fat: toOptionalDecimal(food.fat),
      updated_at: new Date().toISOString(),
    });
  }

  if (!dryRun && toInsert.length > 0) {
    const { error: insertError } = await supabase.from("nutrition_custom_foods").insert(toInsert);
    if (insertError) {
      throw new Error(`Unable to insert custom foods: ${insertError.message}`);
    }
  }

  const foodsById = new Map();
  for (const food of foods) {
    foodsById.set(String(food.id), food);
  }

  return { foodsById, insertedCustomFoods: toInsert.length, existingCustomFoods: (existingRows ?? []).length };
}

async function upsertDay(supabase, memberId, dayDate, settings, dryRun) {
  if (dryRun) {
    return { id: `dry-${memberId}-${dayDate}` };
  }

  const { data, error } = await supabase
    .from("nutrition_days")
    .upsert(
      {
        member_id: memberId,
        day_date: dayDate,
        calorie_target: toOptionalDecimal(settings.calories),
        protein_target: toOptionalDecimal(settings.protein),
        carbs_target: toOptionalDecimal(settings.carbs),
        fat_target: toOptionalDecimal(settings.fat),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Unable to upsert nutrition day ${dayDate}: ${error.message}`);
  }

  return data;
}

async function migrateEntries(supabase, memberId, logJson, foodsById, settings, dryRun) {
  let dayCount = 0;
  let entryCount = 0;

  for (const [dayDate, dayMeals] of Object.entries(logJson)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayDate)) {
      continue;
    }

    const day = await upsertDay(supabase, memberId, dayDate, settings, dryRun);
    dayCount += 1;

    const inserts = [];

    for (const [mealName, entries] of Object.entries(dayMeals ?? {})) {
      const normalizedMeal = MEAL_MAP[String(mealName).toLowerCase()];
      if (!normalizedMeal || !Array.isArray(entries)) {
        continue;
      }

      for (const entry of entries) {
        const foodId = String(entry.foodId ?? "");
        const food = foodsById.get(foodId);
        const entryName = String(food?.name ?? foodId).trim();
        if (!entryName) {
          continue;
        }

        inserts.push({
          member_id: memberId,
          day_id: day.id,
          meal_type: normalizedMeal,
          entry_name: entryName,
          quantity: toPositiveDecimal(entry.quantity),
          calories: toOptionalDecimal(food?.calories),
          protein: toOptionalDecimal(food?.protein),
          carbs: toOptionalDecimal(food?.carbs),
          fat: toOptionalDecimal(food?.fat),
          updated_at: new Date().toISOString(),
        });
      }
    }

    entryCount += inserts.length;

    if (!dryRun && inserts.length > 0) {
      const { error: insertError } = await supabase.from("nutrition_entries").insert(inserts);
      if (insertError) {
        throw new Error(`Unable to insert nutrition entries for ${dayDate}: ${insertError.message}`);
      }
    }
  }

  return { dayCount, entryCount };
}

async function main() {
  await loadEnvLocal();
  const args = parseArgs(process.argv);
  const dryRun = args["dry-run"] !== "false";

  const sourceDir = path.resolve(args["source-dir"] || "../syd/sydney-app");
  const foodsPath = path.join(sourceDir, "foods.json");
  const logPath = path.join(sourceDir, "nutrition-log.json");
  const settingsPath = path.join(sourceDir, "nutrition-settings.json");

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const memberId = await resolveMemberId(supabase, args);
  const foods = await readJson(foodsPath);
  const logJson = await readJson(logPath);
  const settings = await readJson(settingsPath);

  const foodSummary = await ensureCustomFoods(supabase, memberId, foods, dryRun);
  const entrySummary = await migrateEntries(supabase, memberId, logJson, foodSummary.foodsById, settings, dryRun);

  console.log(JSON.stringify({
    mode: dryRun ? "dry-run" : "apply",
    sourceDir,
    memberId,
    existingCustomFoods: foodSummary.existingCustomFoods,
    insertedCustomFoods: foodSummary.insertedCustomFoods,
    importedDays: entrySummary.dayCount,
    importedEntries: entrySummary.entryCount,
    notes: [
      "Quantity and macro values preserve decimal precision in target schema.",
      "Run again with --dry-run false to apply writes.",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
