#!/usr/bin/env node
import fs from "node:fs/promises";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

async function loadEnvLocal() {
  try {
    const text = await fs.readFile(".env.local", "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function main() {
  const memberId = process.argv[2];
  if (!memberId) {
    throw new Error("Usage: node scripts/verify-nutrition-counts.mjs <member-id>");
  }

  await loadEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [daysRes, entriesRes, foodsRes] = await Promise.all([
    supabase.from("nutrition_days").select("*", { head: true, count: "exact" }).eq("member_id", memberId),
    supabase.from("nutrition_entries").select("*", { head: true, count: "exact" }).eq("member_id", memberId),
    supabase.from("nutrition_custom_foods").select("*", { head: true, count: "exact" }).eq("member_id", memberId),
  ]);

  if (daysRes.error || entriesRes.error || foodsRes.error) {
    throw new Error(daysRes.error?.message || entriesRes.error?.message || foodsRes.error?.message || "Unknown verify error");
  }

  console.log(JSON.stringify({
    memberId,
    nutritionDays: daysRes.count ?? 0,
    nutritionEntries: entriesRes.count ?? 0,
    nutritionCustomFoods: foodsRes.count ?? 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
