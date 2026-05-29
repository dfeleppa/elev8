import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SELECT_COLUMNS =
  "id, week_ending_date, coaching_hours, office_hours, total_pay, pay_date, notes, staff_user_id, " +
  "staff:app_users!payroll_entries_staff_user_id_fkey(full_name, email)";

type PayrollRow = {
  id: string;
  week_ending_date: string;
  coaching_hours: number | string;
  office_hours: number | string;
  total_pay: number | string;
  pay_date: string | null;
  notes: string | null;
  staff_user_id: string;
  staff: { full_name: string | null; email: string | null } | null;
};

function serializeEntry(row: PayrollRow) {
  return {
    id: row.id,
    weekEndingDate: row.week_ending_date,
    staffUserId: row.staff_user_id,
    staffName: row.staff?.full_name?.trim() || row.staff?.email?.trim() || "Unknown staff",
    coachingHours: Number(row.coaching_hours),
    officeHours: Number(row.office_hours),
    totalPay: Number(row.total_pay),
    payDate: row.pay_date ?? "",
    notes: row.notes ?? "",
  };
}

export async function GET(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("payroll_entries")
    .select(SELECT_COLUMNS)
    .order("week_ending_date", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const entries = ((data ?? []) as unknown as PayrollRow[]).map(serializeEntry);

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    weekEndingDate?: string;
    staffUserId?: string;
    coachingHours?: number;
    officeHours?: number;
    totalPay?: number;
    payDate?: string;
    notes?: string;
  } | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.weekEndingDate || !payload.staffUserId?.trim()) {
    return NextResponse.json(
      { error: "Week ending date and staff member are required." },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("payroll_entries")
    .insert({
      week_ending_date: payload.weekEndingDate,
      staff_user_id: payload.staffUserId.trim(),
      coaching_hours: payload.coachingHours ?? 0,
      office_hours: payload.officeHours ?? 0,
      total_pay: payload.totalPay ?? 0,
      pay_date: payload.payDate || null,
      notes: payload.notes ?? "",
    })
    .select(SELECT_COLUMNS)
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ entry: serializeEntry(data as unknown as PayrollRow) });
}

export async function PATCH(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    weekEndingDate?: string;
    staffUserId?: string;
    coachingHours?: number;
    officeHours?: number;
    totalPay?: number;
    payDate?: string;
    notes?: string;
  } | null;

  if (!payload?.id) {
    return NextResponse.json({ error: "Entry ID required." }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("payroll_entries")
    .update({
      week_ending_date: payload.weekEndingDate,
      staff_user_id: payload.staffUserId?.trim(),
      coaching_hours: payload.coachingHours,
      office_hours: payload.officeHours,
      total_pay: payload.totalPay,
      pay_date: payload.payDate || null,
      notes: payload.notes ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select(SELECT_COLUMNS)
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ entry: serializeEntry(data as unknown as PayrollRow) });
}

export async function DELETE(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    id?: string;
  } | null;

  if (!payload?.id) {
    return NextResponse.json({ error: "Entry ID required." }, { status: 400 });
  }

  const { error: dbError } = await supabaseAdmin
    .from("payroll_entries")
    .delete()
    .eq("id", payload.id);

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
