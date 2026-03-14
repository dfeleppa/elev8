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
    // .env.local is optional.
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
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? next : "true";
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
    return { header: [], rows: [] };
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

  return { header, rows };
}

function parseDateOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getField(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return "";
}

function parseNumberOrNull(value) {
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (!text) {
    return null;
  }

  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

function cleanRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

async function main() {
  await loadEnvLocal();

  const args = parseArgs(process.argv);
  const filePath = args.file || "public/members - active-memberships.csv";

  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const csvText = await fs.readFile(filePath, "utf8");
  const { header, rows } = parseCsv(csvText);

  const hasSnakeCaseFormat =
    header.includes("first_name") && header.includes("last_name") && header.includes("membership");
  const hasExportFormat =
    header.includes("First Name") && header.includes("Last Name") && header.includes("Membership(s)");

  if (!hasSnakeCaseFormat && !hasExportFormat) {
    throw new Error(
      `CSV '${filePath}' is not a supported members file. Expected either snake_case columns or exported columns like 'First Name', 'Last Name', 'Membership(s)'.`
    );
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let defaultOrganizationId = null;
  const argOrganizationId = String(args.organizationId || "").trim();
  if (isUuid(argOrganizationId)) {
    defaultOrganizationId = argOrganizationId;
  } else {
    const { data: memberships, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .limit(1);

    if (membershipError) {
      throw new Error(`Failed to resolve organization id from memberships: ${membershipError.message}`);
    }

    const membershipOrgId = memberships?.[0]?.organization_id;
    if (isUuid(membershipOrgId)) {
      defaultOrganizationId = membershipOrgId;
    } else {
      const { data: organizations, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .limit(1);

      if (orgError) {
        throw new Error(`Failed to resolve fallback organization id: ${orgError.message}`);
      }

      const fallbackId = organizations?.[0]?.id;
      if (isUuid(fallbackId)) {
        defaultOrganizationId = fallbackId;
      }
    }
  }

  if (!defaultOrganizationId) {
    throw new Error(
      "Could not determine a valid organization id. Pass --organizationId <uuid> when running reseed-members.mjs."
    );
  }

  const mapped = rows.map(({ row }) => {
    const role = String(getField(row, ["role", "Role"]) || "").trim() || "member";

    return cleanRow({
      organization_id: defaultOrganizationId,
      first_name: String(getField(row, ["first_name", "First Name"]) || "").trim() || null,
      last_name: String(getField(row, ["last_name", "Last Name"]) || "").trim() || null,
      membership: String(getField(row, ["membership", "Membership(s)"]) || "").trim() || null,
      last_check_in: parseDateOrNull(getField(row, ["last_check_in", "Last Class Check-In"])),
      mrr: parseNumberOrNull(getField(row, ["mrr", "MRR"])),
      created_at: parseDateOrNull(getField(row, ["created_at", "Member Since"])),
      updated_at: parseDateOrNull(getField(row, ["updated_at", "Last Active on App"])),
      email: String(getField(row, ["email", "Email"]) || "").trim() || null,
      role,
    });
  });

  // Delete all existing entries before reseed.
  const { error: deleteError } = await supabase
    .from("organization_members")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    throw new Error(`Failed to delete existing members: ${deleteError.message}`);
  }

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < mapped.length; i += batchSize) {
    const slice = mapped.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("organization_members").insert(slice);
    if (insertError) {
      throw new Error(`Failed to insert batch starting at row ${i + 1}: ${insertError.message}`);
    }
    inserted += slice.length;
  }

  console.log(`Reseed complete. Deleted existing rows and inserted ${inserted} rows from '${filePath}'.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
