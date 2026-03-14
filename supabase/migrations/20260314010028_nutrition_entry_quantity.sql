alter table if exists nutrition_entries
	add column if not exists quantity integer not null default 1;
