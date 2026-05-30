-- Update the dietary fiber goal to 1 g per 72 kcal of target_calories
-- (previously 14 g per 1000 kcal, i.e. ~1 g per 71.4 kcal), keeping the 25 g floor.
-- Only recompute rows whose stored value still matches the OLD auto-computed
-- formula, so coach-customized fiber targets are left untouched.

update coach_nutrition_plans
set fiber_grams = greatest(25, round(target_calories / 72))::numeric(10,2)
where target_calories is not null
  and target_calories > 0
  and fiber_grams = greatest(25, round((14 * target_calories) / 1000))::numeric(10,2);

update nutrition_days nd
set fiber_target = greatest(25, round(cnp.target_calories / 72))::numeric(10,2),
    updated_at = now()
from coach_nutrition_plans cnp
where nd.member_id = cnp.member_id
  and cnp.effective_date <= nd.day_date
  and cnp.target_calories is not null
  and cnp.target_calories > 0
  and nd.fiber_target = greatest(25, round((14 * cnp.target_calories) / 1000))::numeric(10,2)
  and cnp.id = (
    select id from coach_nutrition_plans
    where member_id = nd.member_id
      and effective_date <= nd.day_date
    order by effective_date desc
    limit 1
  );
