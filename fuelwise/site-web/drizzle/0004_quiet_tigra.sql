CREATE TABLE `apple_health_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`measured_on` text NOT NULL,
	`weight_kg` real,
	`body_fat_percent` real,
	`active_energy_kcal` real,
	`resting_energy_kcal` real,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_apple_health_user_date` ON `apple_health_daily` (`user_id`,`measured_on`);