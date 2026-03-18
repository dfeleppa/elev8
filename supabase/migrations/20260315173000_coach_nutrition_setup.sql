alter table if exists app_users
  add column if not exists sex text,
  add column if not exists birth_date date,
  add column if not exists height_cm numeric(6,2),
  add column if not exists current_weight_kg numeric(6,2),
  add column if not exists body_fat_percent numeric(5,2);

alter table if exists app_users
  drop constraint if exists app_users_sex_check;

alter table if exists app_users
  add constraint app_users_sex_check
  check (sex in ('male', 'female') or sex is null);

create table if not exists coach_nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references app_users(id) on delete cascade,
  member_id uuid not null references app_users(id) on delete cascade,
  goal_type text not null,
  intensity_preset text not null,
  weekly_rate_percent numeric(5,2),
  reverse_diet_weekly_kcal integer,
  target_weight_kg numeric(6,2),
  maintenance_calories numeric(10,2) not null,
  target_calories numeric(10,2) not null,
  protein_grams numeric(10,2) not null,
  carbs_grams numeric(10,2) not null,
  fat_grams numeric(10,2) not null,
  formula_used text not null,
  activity_multiplier numeric(5,2) not null,
  sessions_per_week numeric(5,2) not null,
  effective_date date not null,
  last_check_in_date date,
  next_check_in_date date,
  plan_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, effective_date)
);

create index if not exists coach_nutrition_plans_member_idx
  on coach_nutrition_plans(member_id, effective_date desc);

create index if not exists coach_nutrition_plans_coach_idx
  on coach_nutrition_plans(coach_id, created_at desc);
