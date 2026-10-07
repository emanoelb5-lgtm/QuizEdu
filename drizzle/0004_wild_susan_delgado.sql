CREATE TABLE `native_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_hash` text NOT NULL,
	`device_name` text NOT NULL,
	`owner` text,
	`source_owner` text,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`approved_at` integer,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_native_secret` ON `native_sessions` (`secret_hash`);--> statement-breakpoint
CREATE INDEX `idx_native_owner` ON `native_sessions` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_native_ip_created` ON `native_sessions` (`ip_hash`,`created_at`);