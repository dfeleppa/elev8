alter table if exists nutrition_entries
	add column if not exists fiber numeric(10,2),
	add column if not exists sugar numeric(10,2),
	add column if not exists saturated_fat numeric(10,2);

alter table if exists nutrition_custom_foods
	add column if not exists fiber numeric(10,2),
	add column if not exists sugar numeric(10,2),
	add column if not exists saturated_fat numeric(10,2);
