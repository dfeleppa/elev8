-- Upserts from workout entry and CSV imports must never lower lifetime PRs.
-- BEFORE UPDATE runs under the conflict row lock, including concurrent upserts.
begin;
create function public.preserve_movement_personal_records()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.best_weight := greatest(old.best_weight, new.best_weight);
  new.best_reps := greatest(old.best_reps, new.best_reps);
  new.estimated_one_rep_max := greatest(old.estimated_one_rep_max, new.estimated_one_rep_max);

  -- Keep the original record's provenance when no metric improved.
  if new.best_weight is not distinct from old.best_weight
    and new.best_reps is not distinct from old.best_reps
    and new.estimated_one_rep_max is not distinct from old.estimated_one_rep_max then
    -- Allow the FK's ON DELETE SET NULL when a source result is removed.
    if new.source_result_id is not null then
      new.source_result_id := old.source_result_id;
    end if;
    new.recorded_at := old.recorded_at;
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_movement_personal_records() from public;
create trigger preserve_movement_personal_records
before update on public.member_movement_prs
for each row execute function public.preserve_movement_personal_records();
commit;
