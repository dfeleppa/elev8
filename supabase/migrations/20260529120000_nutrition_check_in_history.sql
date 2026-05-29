-- Extend nutrition_check_ins so each member-initiated weekly check-in stores a
-- complete, auditable record: the metrics they submitted, whether they
-- self-reported as accountable, what we recommended, and the resulting outcome.
-- Existing cron-queued rows keep working unchanged (all new columns are nullable
-- and `source` defaults to 'cron').

alter table if exists nutrition_check_ins
  add column if not exists body_weight_lbs numeric(7, 1),
  add column if not exists body_fat_percent numeric(5, 2),
  add column if not exists self_reported_accountable boolean,
  add column if not exists calorie_delta integer,
  add column if not exists outcome text,
  add column if not exists source text not null default 'cron';

-- Outcome of a completed check-in (null while still pending).
alter table if exists nutrition_check_ins
  drop constraint if exists nutrition_check_ins_outcome_check;

alter table if exists nutrition_check_ins
  add constraint nutrition_check_ins_outcome_check
  check (
    outcome is null
    or outcome in (
      'adjusted',
      'held_on_pace',
      'no_change_not_accountable',
      'counter_reset',
      'guardrail_blocked'
    )
  );

-- Where the row originated.
alter table if exists nutrition_check_ins
  drop constraint if exists nutrition_check_ins_source_check;

alter table if exists nutrition_check_ins
  add constraint nutrition_check_ins_source_check
  check (source in ('cron', 'member', 'coach'));
