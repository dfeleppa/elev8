import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("app_users")
    .select("sex, birth_date")
    .eq("id", userId)
    .maybeSingle();

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  let age: number | null = null;
  if (data?.birth_date) {
    const dob = new Date(`${data.birth_date}T00:00:00`);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const monthDelta = now.getMonth() - dob.getMonth();
      if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
        age -= 1;
      }
    }
  }

  return NextResponse.json({
    sex: data?.sex ?? null,
    birthDate: data?.birth_date ?? null,
    age,
  });
}

export async function PUT(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sex = typeof body?.sex === "string" ? body.sex.trim() : null;
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate.trim() : null;

  if (sex && !["male", "female"].includes(sex)) {
    return NextResponse.json({ error: "Sex must be 'male' or 'female'." }, { status: 400 });
  }

  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return NextResponse.json({ error: "Invalid birth date format. Use YYYY-MM-DD." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (sex !== null) patch.sex = sex;
  if (birthDate !== null) patch.birth_date = birthDate;

  const { data, error: updateError } = await supabaseAdmin
    .from("app_users")
    .update(patch)
    .eq("id", userId)
    .select("sex, birth_date")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let age: number | null = null;
  if (data?.birth_date) {
    const dob = new Date(`${data.birth_date}T00:00:00`);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const monthDelta = now.getMonth() - dob.getMonth();
      if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
        age -= 1;
      }
    }
  }

  return NextResponse.json({
    sex: data?.sex ?? null,
    birthDate: data?.birth_date ?? null,
    age,
  });
}
