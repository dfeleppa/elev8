create table if not exists nutrition_custom_foods (
	id uuid primary key default gen_random_uuid(),
	member_id uuid not null,
	name text not null,
	calories integer,
	protein integer,
	carbs integer,
	fat integer,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

create index if not exists nutrition_custom_foods_member_idx
	on nutrition_custom_foods(member_id, created_at desc);

alter table if exists nutrition_custom_foods enable row level security;

drop policy if exists nutrition_custom_foods_member_access on nutrition_custom_foods;
create policy nutrition_custom_foods_member_access
	on nutrition_custom_foods
	for all
	to authenticated
	using (member_id = auth.uid())
	with check (member_id = auth.uid());
