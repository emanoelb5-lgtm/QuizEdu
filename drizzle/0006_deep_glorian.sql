CREATE TABLE `poll_votes` (
	`room` text NOT NULL,
	`player` text NOT NULL,
	`question_index` integer NOT NULL,
	`choices` text NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`room`, `player`, `question_index`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_poll_votes_round` ON `poll_votes` (`room`,`question_index`);
--> statement-breakpoint
CREATE TRIGGER `poll_votes_signal_insert` AFTER INSERT ON `poll_votes` BEGIN
  UPDATE rooms SET roster_version = roster_version + 1, answered_count = answered_count + CASE WHEN question_index = NEW.question_index THEN 1 ELSE 0 END WHERE code = NEW.room;
END;
