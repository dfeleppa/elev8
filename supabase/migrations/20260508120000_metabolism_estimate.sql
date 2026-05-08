-- Empirical metabolism (TDEE) estimate persisted on the active coach plan.
-- The cron at /api/cron/nutrition-check-in computes a fresh estimate from
-- the last 7 days of food logs + body-weight entries and writes it back here.
-- When the estimate is high-confidence and differs from the formula value by
-- more than 100 kcal, maintenance_calories is auto-updated and source flips
-- from 'formula' to 'empirical'.

alter table if exists coach_nutrition_plans
  add column if not exists maintenance_calories_source text not null default 'formula',
  add column if not exists maintenance_calories_estimated_at timestamptz,
  add column if not exists last_metabolism_estimate jsonb;

alter table if exists coach_nutrition_plans
  drop constraint if exists coach_nutrition_plans_maintenance_source_check;

alter table if exists coach_nutrition_plans
  add constraint coach_nutrition_plans_maintenance_source_check
  check (maintenance_calories_source in ('formula', 'empirical'));
