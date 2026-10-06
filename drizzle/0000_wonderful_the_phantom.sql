CREATE TABLE `answers` (
	`room` text NOT NULL,
	`player` text NOT NULL,
	`question_index` integer NOT NULL,
	`option` integer NOT NULL,
	`correct` integer NOT NULL,
	`points` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`room`, `player`, `question_index`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_answers_round` ON `answers` (`room`,`question_index`);--> statement-breakpoint
CREATE TABLE `educators` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_educators_secret` ON `educators` (`secret_hash`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`secret_hash` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`avatar` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_room_name` ON `players` (`room`,`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_room_secret` ON `players` (`room`,`secret_hash`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`questions` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_quizzes_owner` ON `quizzes` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`teacher` text NOT NULL,
	`questions` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`question_index` integer DEFAULT -1 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`player_count` integer DEFAULT 0 NOT NULL,
	`answered_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_owner_status` ON `rooms` (`owner`,`status`,`expires_at`);
--> statement-breakpoint
CREATE TRIGGER `players_count_insert` AFTER INSERT ON `players` BEGIN
  UPDATE rooms SET player_count = player_count + 1 WHERE code = NEW.room;
END;
--> statement-breakpoint
CREATE TRIGGER `players_count_delete` AFTER DELETE ON `players` BEGIN
  UPDATE rooms SET player_count = MAX(0, player_count - 1) WHERE code = OLD.room;
END;
--> statement-breakpoint
CREATE TRIGGER `answers_count_insert` AFTER INSERT ON `answers` BEGIN
  UPDATE rooms SET answered_count = answered_count + 1 WHERE code = NEW.room AND question_index = NEW.question_index;
END;
