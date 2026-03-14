alter table if exists nutrition_entries
	add column if not exists member_id uuid;

update nutrition_entries as entry
set member_id = day.member_id
from nutrition_days as day
where entry.day_id = day.id
	and entry.member_id is null
	and day.member_id is not null;

alter table if exists nutrition_days
	drop constraint if exists nutrition_days_member_required;

alter table if exists nutrition_days
	add constraint nutrition_days_member_required
	check (member_id is not null) not valid;

alter table if exists nutrition_entries
	drop constraint if exists nutrition_entries_member_required;

alter table if exists nutrition_entries
	add constraint nutrition_entries_member_required
	check (member_id is not null) not valid;

create unique index if not exists nutrition_days_id_member_idx
	on nutrition_days(id, member_id);

alter table if exists nutrition_entries
	drop constraint if exists nutrition_entries_day_id_fkey;

alter table if exists nutrition_entries
	add constraint nutrition_entries_day_member_fkey
	foreign key (day_id, member_id)
	references nutrition_days(id, member_id)
	on delete cascade;
