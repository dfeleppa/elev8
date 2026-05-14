-- Recompose each member's current coach nutrition plan onto the 40/30/30-ish
-- policy with 0.8 g/lb preferred protein, bounded at 0.7-1.0 g/lb.

with latest_plans as (
  select
    p.id,
    p.member_id,
    p.target_calories,
    row_number() over (
      partition by p.member_id
      order by p.effective_date desc, p.created_at desc, p.id desc
    ) as rn
  from public.coach_nutrition_plans p
),
plan_weights as (
  select
    lp.id,
    lp.member_id,
    lp.target_calories::numeric as target_calories,
    coalesce(
      nullif(p.target_weight_lbs, 0),
      case
        when (p.plan_payload ->> 'weightLbs') ~ '^[0-9]+(\.[0-9]+)?$'
          then (p.plan_payload ->> 'weightLbs')::numeric
        else null
      end,
      nullif(u.current_weight_kg, 0) * 2.20462
    ) as reference_weight_lbs
  from latest_plans lp
  join public.coach_nutrition_plans p on p.id = lp.id
  left join public.app_users u on u.id = lp.member_id
  where lp.rn = 1
    and lp.target_calories is not null
),
protein_targets as (
  select
    id,
    member_id,
    target_calories,
    case
      when (target_calories * 0.30 / 4) < (reference_weight_lbs * 0.7)
        then reference_weight_lbs * 0.7
      when (target_calories * 0.30 / 4) > (reference_weight_lbs * 1.0)
        then reference_weight_lbs * 1.0
      else reference_weight_lbs * 0.8
    end as protein_grams
  from plan_weights
  where reference_weight_lbs is not null
    and reference_weight_lbs > 0
),
macro_targets as (
  select
    id,
    member_id,
    target_calories,
    protein_grams,
    greatest(
      0,
      least(target_calories * 0.30 / 9, (target_calories - protein_grams * 4) / 9)
    ) as fat_grams
  from protein_targets
),
final_targets as (
  select
    id,
    member_id,
    round(protein_grams, 1) as protein_grams,
    round(greatest(0, (target_calories - protein_grams * 4 - fat_grams * 9) / 4), 1) as carbs_grams,
    round(fat_grams, 1) as fat_grams
  from macro_targets
)
update public.coach_nutrition_plans p
set
  protein_grams = f.protein_grams,
  carbs_grams = f.carbs_grams,
  fat_grams = f.fat_grams,
  updated_at = now()
from final_targets f
where p.id = f.id;

with latest_plans as (
  select
    p.member_id,
    p.target_calories,
    p.protein_grams,
    p.carbs_grams,
    p.fat_grams,
    row_number() over (
      partition by p.member_id
      order by p.effective_date desc, p.created_at desc, p.id desc
    ) as rn
  from public.coach_nutrition_plans p
)
update public.nutrition_days d
set
  calorie_target = lp.target_calories,
  protein_target = lp.protein_grams,
  carbs_target = lp.carbs_grams,
  fat_target = lp.fat_grams,
  updated_at = now()
from latest_plans lp
where lp.rn = 1
  and d.member_id = lp.member_id
  and d.day_date >= current_date;
