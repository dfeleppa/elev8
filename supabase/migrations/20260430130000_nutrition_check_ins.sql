-- Pending nutrition plan check-in recommendations awaiting coach review.

create table if not exists nutrition_check_ins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references app_users(id) on delete cascade,
  plan_id uuid not null references coach_nutrition_plans(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'dismissed', 'superseded')),
  recommendation jsonb not null,
  reviewed_by uuid references app_users(id) on delete set null,
  reviewed_at timestamptz,
  applied_plan_id uuid references coach_nutrition_plans(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Only one pending check-in per member at a time.
create unique index if not exists nutrition_check_ins_unique_pending
  on nutrition_check_ins(member_id) where status = 'pending';

create index if not exists nutrition_check_ins_member_idx
  on nutrition_check_ins(member_id, created_at desc);

create index if not exists nutrition_check_ins_status_idx
  on nutrition_check_ins(status, created_at desc);
