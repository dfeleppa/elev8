alter table if exists nutrition_custom_foods
	add column if not exists serving_size numeric(10,2) default 1,
	add column if not exists serving_unit text default 'gram';
