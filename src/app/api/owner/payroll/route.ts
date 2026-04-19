import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }
  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  const { data, error: dbError } = await supabaseAdmin
    .from("payroll_entries")
    .select("*")
    .order("week_ending_date", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const entries = (data ?? []).map((row) => ({
    id: row.id,
    weekEndingDate: row.week_ending_date,
    staffName: row.staff_name,
    coachingHours: Number(row.coaching_hours),
    officeHours: Number(row.office_hours),
    totalPay: Number(row.total_pay),
    payDate: row.pay_date ?? "",
    notes: row.notes ?? "",
  }));

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
    staffName?: string;
    coachingHours?: number;
    officeHours?: number;
    totalPay?: number;
    payDate?: string;
    notes?: string;
  } | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }


  if (!payload.weekEndingDate || !payload.staffName?.trim()) {
    return NextResponse.json(
      { error: "Week ending date and staff name are required." },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("payroll_entries")
    .insert({
      week_ending_date: payload.weekEndingDate,
      staff_name: payload.staffName.trim(),
      coaching_hours: payload.coachingHours ?? 0,
      office_hours: payload.officeHours ?? 0,
      total_pay: payload.totalPay ?? 0,
      pay_date: payload.payDate || null,
      notes: payload.notes ?? "",
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({
    entry: {
      id: data.id,
      weekEndingDate: data.week_ending_date,
      staffName: data.staff_name,
      coachingHours: Number(data.coaching_hours),
      officeHours: Number(data.office_hours),
      totalPay: Number(data.total_pay),
      payDate: data.pay_date ?? "",
      notes: data.notes ?? "",
    },
  });
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
    staffName?: string;
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
      staff_name: payload.staffName?.trim(),
      coaching_hours: payload.coachingHours,
      office_hours: payload.officeHours,
      total_pay: payload.totalPay,
      pay_date: payload.payDate || null,
      notes: payload.notes ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({
    entry: {
      id: data.id,
      weekEndingDate: data.week_ending_date,
      staffName: data.staff_name,
      coachingHours: Number(data.coaching_hours),
      officeHours: Number(data.office_hours),
      totalPay: Number(data.total_pay),
      payDate: data.pay_date ?? "",
      notes: data.notes ?? "",
    },
  });
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
