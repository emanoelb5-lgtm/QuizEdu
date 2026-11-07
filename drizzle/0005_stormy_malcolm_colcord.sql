CREATE TABLE `cloud_words` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`slide_id` text NOT NULL,
	`player` text NOT NULL,
	`word` text NOT NULL,
	`word_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cloud_words_unique` ON `cloud_words` (`room`,`slide_id`,`word_key`);--> statement-breakpoint
CREATE INDEX `idx_cloud_words_player` ON `cloud_words` (`room`,`player`);
--> statement-breakpoint
CREATE TRIGGER `cloud_words_signal_insert` AFTER INSERT ON `cloud_words` BEGIN
  UPDATE rooms SET roster_version = roster_version + 1 WHERE code = NEW.room;
END;
