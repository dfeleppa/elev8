alter table if exists nutrition_entries
	alter column quantity type numeric(10,2) using quantity::numeric,
	alter column calories type numeric(10,2) using calories::numeric,
	alter column protein type numeric(10,2) using protein::numeric,
	alter column carbs type numeric(10,2) using carbs::numeric,
	alter column fat type numeric(10,2) using fat::numeric;

alter table if exists nutrition_days
	alter column calorie_target type numeric(10,2) using calorie_target::numeric,
	alter column protein_target type numeric(10,2) using protein_target::numeric,
	alter column carbs_target type numeric(10,2) using carbs_target::numeric,
	alter column fat_target type numeric(10,2) using fat_target::numeric;

alter table if exists nutrition_custom_foods
	alter column calories type numeric(10,2) using calories::numeric,
	alter column protein type numeric(10,2) using protein::numeric,
	alter column carbs type numeric(10,2) using carbs::numeric,
	alter column fat type numeric(10,2) using fat::numeric;
