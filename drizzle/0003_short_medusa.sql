CREATE TABLE `presentations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`write_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_presentations_owner_updated` ON `presentations` (`owner`,`updated_at`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `presentation` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `presentation_id` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `slide_index` integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `build_step` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `blackout` integer DEFAULT 0 NOT NULL;