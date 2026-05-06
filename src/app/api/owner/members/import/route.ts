import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CsvRow = {
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  memberSince: string;
  type: string;
  tags: string;
  trackAccess: string;
  phone: string;
  gender: string;
  address: string;
  birthDate: string;
  attendanceCount: string;
  lastCheckIn: string;
  lastActive: string;
  statusNotes: string;
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, " "));

  // Support both separate first/last name columns and a combined "name" column.
  const firstNameIdx = headers.indexOf("first name");
  const lastNameIdx = headers.indexOf("last name");
  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const statusIdx = headers.indexOf("status");
  const memberSinceIdx = headers.indexOf("member since");
  const typeIdx = headers.findIndex((h) => h === "type" || h === "membership(s)" || h === "membership");
  const tagsIdx = headers.indexOf("tags");
  const trackAccessIdx = headers.findIndex((h) => h === "track access" || h === "tracks");
  const phoneIdx = headers.indexOf("phone");
  const genderIdx = headers.indexOf("gender");
  const addressIdx = headers.indexOf("address");
  const birthDateIdx = headers.findIndex((h) => h === "birth date" || h === "birthdate" || h === "dob");
  const attendanceCountIdx = headers.findIndex((h) => h === "attendance count" || h === "attendance");
  const lastCheckInIdx = headers.findIndex((h) => h === "last class check-in" || h === "last check-in" || h === "last_check_in");
  const lastActiveIdx = headers.findIndex((h) => h === "last active on app" || h === "last active" || h === "last_active");
  const statusNotesIdx = headers.findIndex((h) => h === "status notes" || h === "notes");

  if (emailIdx === -1) {
    throw new Error('CSV must contain an "Email" column.');
  }
  if (firstNameIdx === -1 && nameIdx === -1) {
    throw new Error('CSV must contain "First Name" (or "Name") and "Email" columns.');
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const email = fields[emailIdx]?.trim().toLowerCase() ?? "";
    if (!email || !email.includes("@")) {
      continue;
    }

    let firstName = "";
    let lastName = "";
    if (firstNameIdx !== -1) {
      firstName = fields[firstNameIdx]?.trim() ?? "";
      lastName = lastNameIdx !== -1 ? (fields[lastNameIdx]?.trim() ?? "") : "";
    } else if (nameIdx !== -1) {
      const { first, last } = splitName(fields[nameIdx]?.trim() ?? "");
      firstName = first ?? "";
      lastName = last ?? "";
    }

    rows.push({
      firstName,
      lastName,
      email,
      status: statusIdx !== -1 ? (fields[statusIdx]?.trim() ?? "") : "",
      memberSince: memberSinceIdx !== -1 ? (fields[memberSinceIdx]?.trim() ?? "") : "",
      type: typeIdx !== -1 ? (fields[typeIdx]?.trim() ?? "") : "",
      tags: tagsIdx !== -1 ? (fields[tagsIdx]?.trim() ?? "") : "",
      trackAccess: trackAccessIdx !== -1 ? (fields[trackAccessIdx]?.trim() ?? "") : "",
      phone: phoneIdx !== -1 ? (fields[phoneIdx]?.trim() ?? "") : "",
      gender: genderIdx !== -1 ? (fields[genderIdx]?.trim() ?? "") : "",
      address: addressIdx !== -1 ? (fields[addressIdx]?.trim() ?? "") : "",
      birthDate: birthDateIdx !== -1 ? (fields[birthDateIdx]?.trim() ?? "") : "",
      attendanceCount: attendanceCountIdx !== -1 ? (fields[attendanceCountIdx]?.trim() ?? "") : "",
      lastCheckIn: lastCheckInIdx !== -1 ? (fields[lastCheckInIdx]?.trim() ?? "") : "",
      lastActive: lastActiveIdx !== -1 ? (fields[lastActiveIdx]?.trim() ?? "") : "",
      statusNotes: statusNotesIdx !== -1 ? (fields[statusNotesIdx]?.trim() ?? "") : "",
    });
  }

  return rows;
}

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    return { first: null, last: null };
  }
  const first = parts[0];
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { first, last };
}

function parseDate(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export async function POST(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let csvText: string;
  try {
    csvText = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body." }, { status: 400 });
  }

  let rows: CsvRow[];
  try {
    rows = parseCsv(csvText);
  } catch (parseError) {
    return NextResponse.json({ error: (parseError as Error).message }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in CSV." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const payloads: object[] = [];

  for (const row of rows) {
    payloads.push({
      email: row.email,
      first_name: row.firstName || null,
      last_name: row.lastName || null,
      membership: row.type || null,
      created_at: parseDate(row.memberSince) ?? now,
      updated_at: now,
      role: "member",
      status: row.status || null,
      tags: row.tags || null,
      tracks: row.trackAccess || null,
      phone: row.phone || null,
      gender: row.gender || null,
      address: row.address || null,
      birth_date: parseDate(row.birthDate) ?? null,
      attendance_count: row.attendanceCount ? parseInt(row.attendanceCount, 10) || null : null,
      last_check_in: parseDate(row.lastCheckIn) ?? null,
      last_active: parseDate(row.lastActive) ?? null,
      status_notes: row.statusNotes || null,
    });
  }

  // Deduplicate by email — last row for a given email wins.
  const dedupedMap = new Map<string, object>();
  for (const payload of payloads) {
    dedupedMap.set((payload as { email: string }).email, payload);
  }
  const deduped = Array.from(dedupedMap.values());

  const BATCH_SIZE = 500;
  let upserted = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const { error: upsertError } = await supabaseAdmin
      .from("app_users")
      .upsert(batch, { onConflict: "email" });
    if (upsertError) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
    upserted += batch.length;
  }

  return NextResponse.json({ ok: true, total: rows.length, inserted: upserted, updated: 0 });
}
