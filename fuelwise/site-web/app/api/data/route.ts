import { getChatGPTUser } from '../../chatgpt-auth';
import { getRawDb } from '../../../db';
import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type FuelwiseUser = { userId: string; displayName: string };

async function getFuelwiseUser(request: Request): Promise<FuelwiseUser | null> {
  const webUser = await getChatGPTUser();
  if (webUser) return webUser;

  const authorization = request.headers.get('authorization');
  const configuredToken = String(env.MOBILE_SYNC_TOKEN ?? '');
  const mobileUserId = String(env.MOBILE_SYNC_USER_ID ?? '');
  if (!configuredToken || !mobileUserId || authorization !== `Bearer ${configuredToken}`) return null;

  return {
    userId: mobileUserId,
    displayName: String(env.MOBILE_SYNC_DISPLAY_NAME ?? 'Daniel'),
  };
}

function safeDate(value: unknown) {
  const date = String(value ?? '');
  return datePattern.test(date) ? date : new Date().toISOString().slice(0, 10);
}

function numberIn(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error('Invalid numeric value.');
  return number;
}

function goalValue(value: unknown) {
  const map: Record<string, string> = { 'Lose fat': 'lose_fat', 'Increase performance': 'performance', 'Reverse diet': 'reverse_diet' };
  const goal = map[String(value)] ?? String(value);
  if (!['lose_fat', 'performance', 'reverse_diet'].includes(goal)) throw new Error('Invalid goal.');
  return goal;
}

function goalLabel(value: string) {
  return ({ lose_fat: 'Lose fat', performance: 'Increase performance', reverse_diet: 'Reverse diet' } as Record<string, string>)[value] ?? 'Lose fat';
}

function mealTypeValue(value: unknown) {
  const mealType = String(value ?? 'snacks').toLowerCase();
  if (!['breakfast', 'lunch', 'dinner', 'snacks'].includes(mealType)) throw new Error('Invalid meal type.');
  return mealType;
}

async function ensureProfile(user: { userId: string; displayName: string }) {
  const db = getRawDb();
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO profiles (user_id, display_name, goal, unit_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(user.userId, user.displayName, 'lose_fat', 'imperial', now, now),
    db.prepare('UPDATE profiles SET display_name = ?, updated_at = ? WHERE user_id = ?').bind(user.displayName, now, user.userId),
  ]);
}

export async function GET(request: Request) {
  const user = await getFuelwiseUser(request);
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  await ensureProfile(user);
  const db = getRawDb();
  const date = safeDate(new URL(request.url).searchParams.get('date'));
  const [profile, foods, weighIn, target, library, appleHealth] = await Promise.all([
    db.prepare('SELECT goal, display_name FROM profiles WHERE user_id = ?').bind(user.userId).first<{ goal: string; display_name: string | null }>(),
    db.prepare('SELECT id, meal_type, name, detail, calories, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, fiber_g FROM food_entries WHERE user_id = ? AND logged_on = ? ORDER BY created_at ASC, id ASC').bind(user.userId, date).all(),
    db.prepare('SELECT weight_kg, body_fat_percent FROM weigh_ins WHERE user_id = ? ORDER BY measured_on DESC, id DESC LIMIT 1').bind(user.userId).first<{ weight_kg: number; body_fat_percent: number | null }>(),
    db.prepare('SELECT calories, protein_g, carbs_g, fat_g FROM macro_targets WHERE user_id = ? ORDER BY effective_on DESC, id DESC LIMIT 1').bind(user.userId).first(),
    db.prepare('SELECT id, name, serving, calories, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, fiber_g, usage_count FROM food_library ORDER BY usage_count DESC, name ASC LIMIT 50').all(),
    db.prepare('SELECT measured_on, weight_kg, body_fat_percent, active_energy_kcal, resting_energy_kcal, synced_at FROM apple_health_daily WHERE user_id = ? ORDER BY measured_on DESC, id DESC LIMIT 1').bind(user.userId).first(),
  ]);
  return Response.json({
    user: { displayName: profile?.display_name ?? user.displayName },
    goal: goalLabel(profile?.goal ?? 'lose_fat'),
    foods: foods.results,
    latestWeighIn: weighIn ? { weightLb: Math.round(weighIn.weight_kg / 0.45359237 * 10) / 10, bodyFat: weighIn.body_fat_percent } : null,
    target,
    library: library.results,
    appleHealth,
  });
}

export async function POST(request: Request) {
  const user = await getFuelwiseUser(request);
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  await ensureProfile(user);
  const db = getRawDb();
  try {
    const body = await request.json() as Record<string, unknown>;
    const date = safeDate(body.date);
    if (body.action === 'add_food') {
      const name = String(body.name ?? '').trim().slice(0, 120);
      const mealType = mealTypeValue(body.mealType);
      const detail = String(body.detail ?? 'Custom serving').trim().slice(0, 160);
      if (!name) throw new Error('Food name is required.');
      const calories = Math.round(numberIn(body.calories, 0, 10000));
      const protein = numberIn(body.protein, 0, 1000);
      const carbs = numberIn(body.carbs, 0, 2000);
      const fat = numberIn(body.fat, 0, 1000);
      const saturatedFat = numberIn(body.saturatedFat ?? 0, 0, 500);
      const sugar = numberIn(body.sugar ?? 0, 0, 1000);
      const fiber = numberIn(body.fiber ?? 0, 0, 500);
      const now = Date.now();
      const result = await db.prepare('INSERT INTO food_entries (user_id, logged_on, meal_type, name, detail, calories, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, fiber_g, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').bind(user.userId, date, mealType, name, detail, calories, protein, carbs, fat, saturatedFat, sugar, fiber, now).first<{ id: number }>();
      await db.prepare('INSERT INTO daily_nutrition (user_id, logged_on, calories, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, fiber_g, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, logged_on) DO UPDATE SET calories = calories + excluded.calories, protein_g = protein_g + excluded.protein_g, carbs_g = carbs_g + excluded.carbs_g, fat_g = fat_g + excluded.fat_g, saturated_fat_g = saturated_fat_g + excluded.saturated_fat_g, sugar_g = sugar_g + excluded.sugar_g, fiber_g = fiber_g + excluded.fiber_g, updated_at = excluded.updated_at').bind(user.userId, date, calories, protein, carbs, fat, saturatedFat, sugar, fiber, now).run();
      return Response.json({ saved: true, id: result?.id });
    }
    if (body.action === 'save_checkin') {
      const goal = goalValue(body.goal);
      const weightKg = numberIn(body.weightLb, 70, 800) * 0.45359237;
      const bodyFat = body.bodyFat == null ? null : numberIn(body.bodyFat, 1, 75);
      const calories = Math.round(numberIn(body.calories, 800, 8000));
      const protein = Math.round(numberIn(body.protein, 20, 500));
      const carbs = Math.round(numberIn(body.carbs, 0, 1000));
      const fat = Math.round(numberIn(body.fat, 10, 500));
      const now = Date.now();
      await db.batch([
        db.prepare('INSERT INTO weigh_ins (user_id, measured_on, weight_kg, body_fat_percent, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, measured_on) DO UPDATE SET weight_kg = excluded.weight_kg, body_fat_percent = excluded.body_fat_percent').bind(user.userId, date, weightKg, bodyFat, now),
        db.prepare('UPDATE profiles SET goal = ?, updated_at = ? WHERE user_id = ?').bind(goal, now, user.userId),
        db.prepare('INSERT INTO check_ins (user_id, checked_in_on, trend_weight_kg, calorie_adherence, protein_adherence, recommendation, calorie_delta, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(user.userId, date, weightKg, 0.94, 0.91, String(body.recommendation ?? 'Targets reviewed'), Number(body.calorieDelta ?? 0), now),
        db.prepare('INSERT INTO macro_targets (user_id, effective_on, calories, protein_g, carbs_g, fat_g, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(user.userId, date, calories, protein, carbs, fat, 'Accepted weekly check-in', now),
      ]);
      return Response.json({ saved: true });
    }
    if (body.action === 'sync_apple_health') {
      const weightKg = body.weightKg == null ? null : numberIn(body.weightKg, 25, 400);
      const bodyFat = body.bodyFat == null ? null : numberIn(body.bodyFat, 1, 75);
      const activeEnergy = body.activeEnergyKcal == null ? null : numberIn(body.activeEnergyKcal, 0, 20000);
      const restingEnergy = body.restingEnergyKcal == null ? null : numberIn(body.restingEnergyKcal, 0, 20000);
      if (weightKg == null && bodyFat == null && activeEnergy == null && restingEnergy == null) throw new Error('No Apple Health values were provided.');
      const now = Date.now();
      await db.prepare('INSERT INTO apple_health_daily (user_id, measured_on, weight_kg, body_fat_percent, active_energy_kcal, resting_energy_kcal, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, measured_on) DO UPDATE SET weight_kg = COALESCE(excluded.weight_kg, weight_kg), body_fat_percent = COALESCE(excluded.body_fat_percent, body_fat_percent), active_energy_kcal = COALESCE(excluded.active_energy_kcal, active_energy_kcal), resting_energy_kcal = COALESCE(excluded.resting_energy_kcal, resting_energy_kcal), synced_at = excluded.synced_at').bind(user.userId, date, weightKg, bodyFat, activeEnergy, restingEnergy, now).run();
      if (weightKg != null) {
        await db.prepare('INSERT INTO weigh_ins (user_id, measured_on, weight_kg, body_fat_percent, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, measured_on) DO UPDATE SET weight_kg = excluded.weight_kg, body_fat_percent = COALESCE(excluded.body_fat_percent, body_fat_percent)').bind(user.userId, date, weightKg, bodyFat, now).run();
      }
      return Response.json({ saved: true, syncedAt: now });
    }
    return Response.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
  }
}
