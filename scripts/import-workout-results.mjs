#!/usr/bin/env node
import fs from "node:fs/promises";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

async function loadEnvLocal() {
  const envPath = ".env.local";
  try {
    const text = await fs.readFile(envPath, "utf8");
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
    // .env.local is optional in some environments.
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) {
      continue;
    }
    const key = part.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[key] = value;
    if (value !== "true") {
      i += 1;
    }
  }
  return args;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = cols[j] ?? "";
    }
    rows.push({ line: i + 1, row });
  }

  return rows;
}

function parseDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) {
    return null;
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso;
}

function toNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDurationToSeconds(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":").map((x) => Number(x));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function normalizeStyle(style) {
  const normalized = String(style ?? "").trim().toLowerCase();
  if (normalized === "time") return { blockType: "workout", scoreType: "time" };
  if (normalized === "reps") return { blockType: "workout", scoreType: "reps" };
  if (normalized === "rounds") return { blockType: "workout", scoreType: "rounds_reps" };
  if (normalized === "distance") return { blockType: "workout", scoreType: "distance" };
  if (normalized === "load") return { blockType: "lift", scoreType: "none" };
  return { blockType: "workout", scoreType: "none" };
}

function parseRoundsReps(score) {
  const match = /^(\d+)\s*\+\s*(\d+)$/.exec(String(score ?? "").trim());
  if (!match) {
    return null;
  }
  return {
    rounds: Number(match[1]),
    reps: Number(match[2]),
    combined: Number(match[1]) * 1000 + Number(match[2]),
  };
}

async function ensureUserAndMembership(supabase, organizationId, email, memberIdArg) {
  if (memberIdArg) {
    const { data: byId, error: byIdError } = await supabase
      .from("app_users")
      .select("id, email")
      .eq("id", memberIdArg)
      .maybeSingle();
    if (byIdError || !byId?.id) {
      throw new Error(`No app_users record found for member id '${memberIdArg}'.`);
    }

    const { error: membershipError } = await supabase.from("organization_memberships").upsert(
      {
        organization_id: organizationId,
        user_id: byId.id,
        role: "member",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" }
    );
    if (membershipError) {
      throw new Error(`Failed to ensure organization membership: ${membershipError.message}`);
    }

    return byId.id;
  }

  const normalized = email.toLowerCase();
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .upsert(
      {
        email: normalized,
        role: "member",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  if (userError || !user?.id) {
    throw new Error(`Failed to upsert app user for '${email}': ${userError?.message ?? "unknown error"}`);
  }

  const { error: membershipError } = await supabase.from("organization_memberships").upsert(
    {
      organization_id: organizationId,
      user_id: user.id,
      role: "member",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" }
  );
  if (membershipError) {
    throw new Error(`Failed to ensure organization membership: ${membershipError.message}`);
  }

  return user.id;
}

async function ensureTrack(supabase, organizationId, userId, trackName) {
  const { data, error } = await supabase
    .from("programming_tracks")
    .upsert(
      {
        organization_id: organizationId,
        name: trackName,
        code: "legacy-import",
        description: "Imported historical workout results",
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,name" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to upsert track '${trackName}': ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

async function ensureDay(supabase, organizationId, trackId, userId, dayDate) {
  const { data, error } = await supabase
    .from("programming_days")
    .upsert(
      {
        organization_id: organizationId,
        track_id: trackId,
        day_date: dayDate,
        title: "Imported",
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "track_id,day_date" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to upsert programming day ${dayDate}: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

async function ensureMovement(supabase, organizationId, movementName) {
  if (!movementName) {
    return null;
  }

  const { data, error } = await supabase
    .from("movement_library")
    .upsert(
      {
        organization_id: organizationId,
        name: movementName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,name" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to upsert movement '${movementName}': ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

async function createBlockIfNeeded({
  supabase,
  dayId,
  organizationId,
  trackId,
  userId,
  title,
  style,
  movementId,
  cache,
}) {
  const styleInfo = normalizeStyle(style);
  const key = `${dayId}::${title}::${styleInfo.blockType}::${styleInfo.scoreType}::${movementId ?? "none"}`;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const { data, error } = await supabase
    .from("workout_blocks")
    .insert({
      programming_day_id: dayId,
      organization_id: organizationId,
      track_id: trackId,
      block_order: cache.size,
      block_type: styleInfo.blockType,
      title,
      score_type: styleInfo.scoreType,
      leaderboard_enabled: styleInfo.blockType !== "warmup" && styleInfo.blockType !== "cooldown",
      benchmark_enabled: false,
      movement_id: movementId,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, block_type, score_type, movement_id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create block '${title}': ${error?.message ?? "unknown error"}`);
  }

  cache.set(key, data);
  return data;
}

async function maybeUpsertPr({ supabase, organizationId, memberId, movementId, resultId, weight, reps }) {
  if (!movementId || !weight || !reps) {
    return;
  }

  const estimated = weight * (1 + reps / 30);

  const { data: existing } = await supabase
    .from("member_movement_prs")
    .select("best_weight, best_reps, estimated_one_rep_max")
    .eq("organization_id", organizationId)
    .eq("member_id", memberId)
    .eq("movement_id", movementId)
    .maybeSingle();

  const currentBest = existing?.best_weight ?? 0;
  const shouldUpdate = weight >= currentBest;
  if (!shouldUpdate) {
    return;
  }

  const { error } = await supabase
    .from("member_movement_prs")
    .upsert(
      {
        organization_id: organizationId,
        member_id: memberId,
        movement_id: movementId,
        best_weight: weight,
        best_reps: reps,
        estimated_one_rep_max: estimated,
        source_result_id: resultId,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,member_id,movement_id" }
    );

  if (error) {
    throw new Error(`Failed to upsert PR: ${error.message}`);
  }
}

async function main() {
  await loadEnvLocal();

  const args = parseArgs(process.argv);
  const csvPath = args.csv;
  const organizationId = args["organization-id"];
  const memberEmail = args["member-email"];
  const memberIdArg = args["member-id"];
  const trackName = args["track-name"] ?? "Legacy Import";
  const dryRun = args["dry-run"] === "true";

  if (!csvPath || !organizationId || (!memberEmail && !memberIdArg)) {
    throw new Error(
      "Usage: node scripts/import-workout-results.mjs --csv uploads/daneff_results.csv --organization-id <org_id> (--member-email <email> | --member-id <user_id>) [--track-name \"Legacy Import\"] [--dry-run]"
    );
  }

  if (memberEmail === "YOUR_EMAIL") {
    throw new Error("Replace YOUR_EMAIL with the member's real email from app_users.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  const content = await fs.readFile(csvPath, "utf8");
  const parsed = parseCsv(content);
  if (parsed.length === 0) {
    throw new Error("CSV is empty.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const memberId = await ensureUserAndMembership(
    supabase,
    organizationId,
    memberEmail ?? "",
    typeof memberIdArg === "string" ? memberIdArg : null
  );

  if (dryRun) {
    console.log(
      `[dry-run] Parsed ${parsed.length} rows for member ${memberEmail ?? "member-id provided"} (${memberId}).`
    );
    return;
  }

  const trackId = await ensureTrack(supabase, organizationId, memberId, trackName);
  const blockCache = new Map();

  let insertedResults = 0;
  const failures = [];

  for (const entry of parsed) {
    const row = entry.row;
    try {
      const title = String(row.Title ?? "").trim() || "Imported Workout";
      const date = parseDate(String(row.Date ?? ""));
      const styleRaw = String(row.Style ?? "").trim();
      const repMax = toNumber(row.RepMax);
      const primaryMovement = String(row.PrimaryMovement ?? "").trim() || null;
      const bestScoreRaw = String(row.BestScore ?? "").trim();
      const notes = String(row.Notes ?? "").trim() || null;

      if (!date) {
        throw new Error(`Invalid date '${row.Date}'.`);
      }

      const dayId = await ensureDay(supabase, organizationId, trackId, memberId, date);
      const movementId = await ensureMovement(supabase, organizationId, primaryMovement);
      const block = await createBlockIfNeeded({
        supabase,
        dayId,
        organizationId,
        trackId,
        userId: memberId,
        title,
        style: styleRaw,
        movementId,
        cache: blockCache,
      });

      const style = normalizeStyle(styleRaw);
      const resultPayload = {
        organization_id: organizationId,
        track_id: trackId,
        block_id: block.id,
        day_date: date,
        member_id: memberId,
        score_type: style.scoreType,
        score_text: bestScoreRaw || null,
        score_value: null,
        total_reps: null,
        rounds: null,
        distance: null,
        calories: null,
        duration_seconds: null,
        is_rx: true,
        notes,
        updated_at: new Date().toISOString(),
      };

      if (style.scoreType === "time") {
        resultPayload.duration_seconds = parseDurationToSeconds(bestScoreRaw);
      }

      if (style.scoreType === "reps") {
        const reps = toNumber(bestScoreRaw);
        resultPayload.total_reps = reps;
        resultPayload.score_value = reps;
      }

      if (style.scoreType === "rounds_reps") {
        const rr = parseRoundsReps(bestScoreRaw);
        if (rr) {
          resultPayload.rounds = rr.rounds;
          resultPayload.total_reps = rr.reps;
          resultPayload.score_value = rr.combined;
        }
      }

      if (style.scoreType === "distance") {
        const distance = toNumber(bestScoreRaw);
        resultPayload.distance = distance;
        resultPayload.score_value = distance;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("workout_results")
        .insert(resultPayload)
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        throw new Error(insertError?.message ?? "Failed to insert workout_result.");
      }

      if (style.blockType === "lift") {
        const weight = toNumber(bestScoreRaw);
        const reps = repMax ?? 1;

        if (weight && reps) {
          const { error: liftSetError } = await supabase.from("workout_result_lift_sets").insert({
            result_id: inserted.id,
            set_order: 1,
            reps,
            weight,
            updated_at: new Date().toISOString(),
          });

          if (liftSetError) {
            throw new Error(`Lift set insert failed: ${liftSetError.message}`);
          }

          await maybeUpsertPr({
            supabase,
            organizationId,
            memberId,
            movementId: movementId ?? block.movement_id,
            resultId: inserted.id,
            weight,
            reps,
          });
        }
      }

      insertedResults += 1;
    } catch (error) {
      failures.push({ line: entry.line, title: entry.row.Title, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(`Import finished. Inserted ${insertedResults}/${parsed.length} results.`);
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
    for (const failure of failures.slice(0, 20)) {
      console.log(`  line ${failure.line} (${failure.title}): ${failure.error}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
