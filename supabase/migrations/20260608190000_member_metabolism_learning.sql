-- Preserve learned metabolism estimates across coach-plan resets.
-- Coach plans can be wiped/rebuilt, but empirical TDEE learning belongs to
-- the member and should survive that workflow.

create table if not exists member_metabolism_learning (
  member_id uuid primary key references app_users(id) on delete cascade,
  maintenance_calories numeric(10,2),
  maintenance_calories_source text not null default 'formula',
  maintenance_calories_estimated_at timestamptz,
  last_metabolism_estimate jsonb,
  updated_at timestamptz not null default now()
);

alter table if exists member_metabolism_learning
  drop constraint if exists member_metabolism_learning_source_check;

alter table if exists member_metabolism_learning
  add constraint member_metabolism_learning_source_check
  check (maintenance_calories_source in ('formula', 'empirical'));
