ALTER TABLE `daily_nutrition` ADD `saturated_fat_g` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_nutrition` ADD `sugar_g` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_nutrition` ADD `fiber_g` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `food_entries` ADD `saturated_fat_g` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `food_entries` ADD `sugar_g` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `food_entries` ADD `fiber_g` real DEFAULT 0 NOT NULL;