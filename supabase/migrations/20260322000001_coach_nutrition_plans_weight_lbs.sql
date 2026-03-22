-- Convert coach_nutrition_plans weight columns from kg to lbs.
-- target_weight_kg → target_weight_lbs (multiply existing values by 2.20462)
-- plan_payload.weightKg is a JSON field handled at the application layer.

alter table coach_nutrition_plans
  add column if not exists target_weight_lbs numeric(7,1);

update coach_nutrition_plans
  set target_weight_lbs = round((target_weight_kg * 2.20462)::numeric, 1)
  where target_weight_kg is not null;

alter table coach_nutrition_plans
  drop column if exists target_weight_kg;
