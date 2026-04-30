-- Add fiber tracking + adherence audit trail to support automated nutrition adjustments.

alter table if exists coach_nutrition_plans
  add column if not exists fiber_grams numeric(10,2),
  add column if not exists adherence_snapshot jsonb,
  add column if not exists previous_plan_id uuid references coach_nutrition_plans(id) on delete set null,
  add column if not exists adjustment_reason text;

alter table if exists nutrition_days
  add column if not exists fiber_target numeric(10,2);

alter table if exists nutrition_entries
  add column if not exists fiber numeric(10,2);

create index if not exists coach_nutrition_plans_previous_plan_idx
  on coach_nutrition_plans(previous_plan_id);
