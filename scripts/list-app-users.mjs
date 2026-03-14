#!/usr/bin/env node
import fs from "node:fs/promises";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

async function loadEnvLocal() {
  try {
    const text = await fs.readFile(".env.local", "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const idx = line.indexOf("=");
      if (idx === -1) {
        continue;
      }
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

async function main() {
  await loadEnvLocal();

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("app_users")
    .select("id,email,role")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  console.log(JSON.stringify(data ?? [], null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
