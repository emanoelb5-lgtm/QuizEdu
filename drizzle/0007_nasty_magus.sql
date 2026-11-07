CREATE TABLE `classroom_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`player` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_reports_room` ON `classroom_reports` (`room`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_support_ip_created` ON `support_requests` (`ip_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `cloud_words` ADD `hidden` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `blocked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TRIGGER `players_block_update` AFTER UPDATE OF `blocked` ON `players` WHEN NEW.blocked <> OLD.blocked BEGIN
  UPDATE rooms SET player_count = MAX(0, player_count + CASE WHEN NEW.blocked = 1 THEN -1 ELSE 1 END), roster_version = roster_version + 1,
    answered_count = (SELECT COUNT(*) FROM answers a JOIN players p ON p.id=a.player WHERE a.room=NEW.room AND a.question_index=rooms.question_index AND p.blocked=0) + (SELECT COUNT(*) FROM poll_votes v JOIN players p ON p.id=v.player WHERE v.room=NEW.room AND v.question_index=rooms.question_index AND p.blocked=0)
  WHERE code=NEW.room;
END;
--> statement-breakpoint
DROP TRIGGER `players_count_delete`;
--> statement-breakpoint
CREATE TRIGGER `players_count_delete` AFTER DELETE ON `players` BEGIN
  UPDATE rooms SET player_count = MAX(0, player_count - CASE WHEN OLD.blocked=0 THEN 1 ELSE 0 END), roster_version = roster_version + 1,
    answered_count = (SELECT COUNT(*) FROM answers a JOIN players p ON p.id=a.player WHERE a.room=OLD.room AND a.question_index=rooms.question_index AND p.blocked=0) + (SELECT COUNT(*) FROM poll_votes v JOIN players p ON p.id=v.player WHERE v.room=OLD.room AND v.question_index=rooms.question_index AND p.blocked=0)
  WHERE code=OLD.room;
END;
--> statement-breakpoint
CREATE TRIGGER `cloud_words_moderate` AFTER UPDATE OF `hidden` ON `cloud_words` WHEN NEW.hidden <> OLD.hidden BEGIN
  UPDATE rooms SET roster_version = roster_version + 1 WHERE code = NEW.room;
END;
