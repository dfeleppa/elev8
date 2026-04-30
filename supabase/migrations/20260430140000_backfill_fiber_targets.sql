-- Add fiber to custom foods so the food library can carry it through to
-- per-entry logging (the entry form already collects fiber).
alter table if exists nutrition_custom_foods
  add column if not exists fiber numeric(10,2);

-- Backfill fiber_grams on existing nutrition plans using the same floor used
-- by the analyzer guardrails: max(25 g, 14 g per 1000 kcal of target_calories).
update coach_nutrition_plans
set fiber_grams = greatest(25, round((14 * target_calories) / 1000))::numeric(10,2)
where fiber_grams is null
  and target_calories is not null
  and target_calories > 0;

-- Backfill fiber_target on existing nutrition_days from their plan, when null.
update nutrition_days nd
set fiber_target = greatest(25, round((14 * cnp.target_calories) / 1000))::numeric(10,2),
    updated_at = now()
from coach_nutrition_plans cnp
where nd.fiber_target is null
  and nd.member_id = cnp.member_id
  and cnp.effective_date <= nd.day_date
  and cnp.target_calories is not null
  and cnp.target_calories > 0
  and cnp.id = (
    select id from coach_nutrition_plans
    where member_id = nd.member_id
      and effective_date <= nd.day_date
    order by effective_date desc
    limit 1
  );
