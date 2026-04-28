-- =============================================================================
-- Programming Corpus — Schema Migration
--
-- Extends the existing Elev8 schema rather than creating a parallel one.
-- All ChalkItPro imports will land in the existing
-- programming_tracks → programming_days → workout_blocks hierarchy.
--
-- This migration is idempotent and safe to re-run.
-- =============================================================================

-- 1. Extensions ---------------------------------------------------------------
create extension if not exists vector;
create extension if not exists pg_trgm;


-- 2. Enrichment columns on workout_blocks -------------------------------------
alter table public.workout_blocks
  add column if not exists stimulus text[] default '{}',
  add column if not exists modality text[] default '{}',
  add column if not exists equipment text[] default '{}',
  add column if not exists time_domain_seconds int,
  add column if not exists rep_scheme text,
  add column if not exists source text default 'elev8'
    check (source in ('elev8', 'chalkitpro', 'sugarwod', 'manual')),
  add column if not exists chalkitpro_import_id uuid,
  add column if not exists tags_reviewed boolean default false,
  add column if not exists tagging_confidence numeric
    check (tagging_confidence is null or (tagging_confidence >= 0 and tagging_confidence <= 1)),
  add column if not exists embedding vector(1536);

comment on column public.workout_blocks.stimulus is
  'Controlled vocabulary tags describing the training intent (e.g. aerobic_capacity, barbell_cycling, positional_strength).';
comment on column public.workout_blocks.modality is
  'Top-level modality tags: weightlifting, gymnastics, monostructural.';
comment on column public.workout_blocks.equipment is
  'Equipment required: barbell, rower, rig, dumbbell, kettlebell, etc.';
comment on column public.workout_blocks.rep_scheme is
  'High-level rep scheme: amrap | for_time | emom | intervals | sets_reps | chipper | other.';
comment on column public.workout_blocks.source is
  'Origin of the row. elev8 = native programming created in-app. chalkitpro/sugarwod = imported.';
comment on column public.workout_blocks.chalkitpro_import_id is
  'Foreign key to programming.chalkitpro_imports.id when source=chalkitpro. Enables full traceability.';
comment on column public.workout_blocks.embedding is
  'OpenAI text-embedding-3-small vector for semantic search.';


-- 3. Import tracking schema ---------------------------------------------------
create schema if not exists programming;

create table if not exists programming.chalkitpro_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,

  source_filename text,
  source_row_number int,
  raw_row jsonb not null,

  parsed_date date,
  parsed_track_name text,
  parsed_title text,
  parsed_body text,

  status text not null default 'pending'
    check (status in ('pending', 'imported', 'skipped', 'failed', 'duplicate')),
  workout_block_id uuid references public.workout_blocks(id) on delete set null,
  programming_day_id uuid references public.programming_days(id) on delete set null,
  error_message text,

  imported_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chalkitpro_imports_user_idx
  on programming.chalkitpro_imports(user_id);
create index if not exists chalkitpro_imports_status_idx
  on programming.chalkitpro_imports(status);
create index if not exists chalkitpro_imports_date_idx
  on programming.chalkitpro_imports(parsed_date);

create or replace function programming.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chalkitpro_imports_set_updated_at
  on programming.chalkitpro_imports;
create trigger chalkitpro_imports_set_updated_at
  before update on programming.chalkitpro_imports
  for each row execute function programming.set_updated_at();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'workout_blocks_chalkitpro_import_id_fkey'
      and table_schema = 'public'
      and table_name = 'workout_blocks'
  ) then
    alter table public.workout_blocks
      add constraint workout_blocks_chalkitpro_import_id_fkey
      foreign key (chalkitpro_import_id)
      references programming.chalkitpro_imports(id)
      on delete set null;
  end if;
end$$;


-- 4. Indexes for new columns --------------------------------------------------
create index if not exists workout_blocks_stimulus_gin
  on public.workout_blocks using gin(stimulus);
create index if not exists workout_blocks_modality_gin
  on public.workout_blocks using gin(modality);
create index if not exists workout_blocks_equipment_gin
  on public.workout_blocks using gin(equipment);
create index if not exists workout_blocks_source_idx
  on public.workout_blocks(source);
create index if not exists workout_blocks_review_queue_idx
  on public.workout_blocks(tags_reviewed, tagging_confidence)
  where tags_reviewed = false;

create index if not exists workout_blocks_embedding_idx
  on public.workout_blocks using ivfflat (embedding vector_cosine_ops)
  with (lists = 30);


-- 5. Semantic search function -------------------------------------------------
create or replace function programming.search_workouts(
  query_embedding vector(1536),
  filter_movements text[] default null,
  filter_stimulus text[] default null,
  filter_modality text[] default null,
  filter_block_type text default null,
  filter_track_id uuid default null,
  filter_source text default null,
  filter_date_from date default null,
  filter_date_to date default null,
  match_count int default 10
)
returns table (
  block_id uuid,
  day_date date,
  track_id uuid,
  track_name text,
  block_type text,
  title text,
  description text,
  tags text[],
  stimulus text[],
  modality text[],
  source text,
  similarity float
)
language sql stable security invoker as $$
  select
    wb.id as block_id,
    pd.day_date,
    pt.id as track_id,
    pt.name as track_name,
    wb.block_type,
    wb.title,
    wb.description,
    wb.tags,
    wb.stimulus,
    wb.modality,
    wb.source,
    1 - (wb.embedding <=> query_embedding) as similarity
  from public.workout_blocks wb
  join public.programming_days pd on pd.id = wb.programming_day_id
  join public.programming_tracks pt on pt.id = wb.track_id
  where wb.embedding is not null
    and (filter_movements is null or wb.tags && filter_movements)
    and (filter_stimulus is null or wb.stimulus && filter_stimulus)
    and (filter_modality is null or wb.modality && filter_modality)
    and (filter_block_type is null or wb.block_type = filter_block_type)
    and (filter_track_id is null or wb.track_id = filter_track_id)
    and (filter_source is null or wb.source = filter_source)
    and (filter_date_from is null or pd.day_date >= filter_date_from)
    and (filter_date_to is null or pd.day_date <= filter_date_to)
  order by wb.embedding <=> query_embedding
  limit match_count;
$$;


-- 6. Convenience view ---------------------------------------------------------
create or replace view programming.v_workouts_full as
select
  wb.id as block_id,
  wb.programming_day_id,
  wb.track_id,
  pd.day_date,
  pt.name as track_name,
  pt.preferred_programming_style as track_style,
  wb.block_order,
  wb.block_type,
  wb.title,
  wb.description,
  wb.score_type,
  wb.rounds,
  wb.percent_prescription,
  wb.tags,
  wb.stimulus,
  wb.modality,
  wb.equipment,
  wb.time_domain_seconds,
  wb.rep_scheme,
  wb.source,
  wb.chalkitpro_import_id,
  wb.tags_reviewed,
  wb.tagging_confidence,
  wb.embedding is not null as has_embedding,
  wb.created_by,
  wb.created_at,
  wb.updated_at
from public.workout_blocks wb
join public.programming_days pd on pd.id = wb.programming_day_id
join public.programming_tracks pt on pt.id = wb.track_id;

comment on view programming.v_workouts_full is
  'Denormalized read-only view of workout_blocks with day and track context.';


-- 7. RLS on the new programming schema ----------------------------------------
alter table programming.chalkitpro_imports enable row level security;

drop policy if exists chalkitpro_imports_select_own on programming.chalkitpro_imports;
create policy chalkitpro_imports_select_own on programming.chalkitpro_imports
  for select using (
    user_id in (select id from public.app_users where supabase_auth_uid = auth.uid())
  );

drop policy if exists chalkitpro_imports_insert_own on programming.chalkitpro_imports;
create policy chalkitpro_imports_insert_own on programming.chalkitpro_imports
  for insert with check (
    user_id in (select id from public.app_users where supabase_auth_uid = auth.uid())
  );

drop policy if exists chalkitpro_imports_update_own on programming.chalkitpro_imports;
create policy chalkitpro_imports_update_own on programming.chalkitpro_imports
  for update using (
    user_id in (select id from public.app_users where supabase_auth_uid = auth.uid())
  );

drop policy if exists chalkitpro_imports_delete_own on programming.chalkitpro_imports;
create policy chalkitpro_imports_delete_own on programming.chalkitpro_imports
  for delete using (
    user_id in (select id from public.app_users where supabase_auth_uid = auth.uid())
  );


-- 8. Schema usage grants ------------------------------------------------------
grant usage on schema programming to authenticated, service_role;
grant all on all tables in schema programming to authenticated, service_role;
grant all on all functions in schema programming to authenticated, service_role;
grant all on all sequences in schema programming to authenticated, service_role;
grant select on programming.v_workouts_full to authenticated, service_role;
