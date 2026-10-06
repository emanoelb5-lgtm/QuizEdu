CREATE TABLE `drafts` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`quiz` text NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`write_id` text NOT NULL,
	PRIMARY KEY(`owner`, `id`),
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_owner_updated` ON `drafts` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `question_bank` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`question` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`topic` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bank_owner_updated` ON `question_bank` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `shares` (
	`token` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`owner` text NOT NULL,
	`quiz` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shares_quiz` ON `shares` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `idx_shares_owner` ON `shares` (`owner`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_uploads_owner` ON `uploads` (`owner`);--> statement-breakpoint
ALTER TABLE `educators` ADD `auth_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_educators_auth` ON `educators` (`auth_id`);--> statement-breakpoint
ALTER TABLE `players` ADD `last_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `mode` text DEFAULT 'speed' NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `untimed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `subject` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `topic` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `mode` text DEFAULT 'speed' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `untimed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_rooms_owner_created` ON `rooms` (`owner`,`created_at`);