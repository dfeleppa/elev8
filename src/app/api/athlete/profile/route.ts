import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export async function GET() {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { data, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, email, full_name, sex, birth_date, height_cm, current_weight_kg, body_fat_percent, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({
    fullName: data?.full_name ?? null,
    email: data?.email ?? null,
    sex: data?.sex ?? null,
    birthDate: data?.birth_date ?? null,
    age: computeAge(data?.birth_date ?? null),
    heightCm: data?.height_cm ?? null,
    weightKg: data?.current_weight_kg ?? null,
    bodyFatPercent: data?.body_fat_percent ?? null,
    createdAt: data?.created_at ?? null,
    role,
  });
}

export async function PUT(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : undefined;
  const sex = typeof body?.sex === "string" ? body.sex.trim() || null : undefined;
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate.trim() || null : undefined;
  const heightCm = body?.heightCm !== undefined ? (body.heightCm === null ? null : Number(body.heightCm)) : undefined;
  const weightKg = body?.weightKg !== undefined ? (body.weightKg === null ? null : Number(body.weightKg)) : undefined;
  const bodyFatPercent = body?.bodyFatPercent !== undefined ? (body.bodyFatPercent === null ? null : Number(body.bodyFatPercent)) : undefined;

  if (sex !== undefined && sex !== null && !["male", "female"].includes(sex)) {
    return NextResponse.json({ error: "Sex must be 'male' or 'female'." }, { status: 400 });
  }
  if (birthDate !== undefined && birthDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return NextResponse.json({ error: "Invalid birth date format. Use YYYY-MM-DD." }, { status: 400 });
  }
  if (heightCm !== undefined && heightCm !== null && (!Number.isFinite(heightCm) || heightCm <= 0)) {
    return NextResponse.json({ error: "Invalid height." }, { status: 400 });
  }
  if (weightKg !== undefined && weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) {
    return NextResponse.json({ error: "Invalid weight." }, { status: 400 });
  }
  if (bodyFatPercent !== undefined && bodyFatPercent !== null && (!Number.isFinite(bodyFatPercent) || bodyFatPercent < 1 || bodyFatPercent > 99)) {
    return NextResponse.json({ error: "Body fat must be between 1 and 99." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) patch.full_name = fullName || null;
  if (sex !== undefined) patch.sex = sex;
  if (birthDate !== undefined) patch.birth_date = birthDate;
  if (heightCm !== undefined) patch.height_cm = heightCm;
  if (weightKg !== undefined) patch.current_weight_kg = weightKg;
  if (bodyFatPercent !== undefined) patch.body_fat_percent = bodyFatPercent;

  const { data, error: updateError } = await supabaseAdmin
    .from("app_users")
    .update(patch)
    .eq("id", userId)
    .select("email, full_name, sex, birth_date, height_cm, current_weight_kg, body_fat_percent, created_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({
    fullName: data?.full_name ?? null,
    email: data?.email ?? null,
    sex: data?.sex ?? null,
    birthDate: data?.birth_date ?? null,
    age: computeAge(data?.birth_date ?? null),
    heightCm: data?.height_cm ?? null,
    weightKg: data?.current_weight_kg ?? null,
    bodyFatPercent: data?.body_fat_percent ?? null,
    createdAt: data?.created_at ?? null,
  });
}
