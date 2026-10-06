ALTER TABLE `rooms` ADD `roster_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DROP TRIGGER `players_count_insert`;
--> statement-breakpoint
DROP TRIGGER `players_count_delete`;
--> statement-breakpoint
CREATE TRIGGER `players_count_insert` AFTER INSERT ON `players` BEGIN
  UPDATE rooms SET player_count = player_count + 1, roster_version = roster_version + 1 WHERE code = NEW.room;
END;
--> statement-breakpoint
CREATE TRIGGER `players_count_delete` AFTER DELETE ON `players` BEGIN
  UPDATE rooms SET player_count = MAX(0, player_count - 1), roster_version = roster_version + 1 WHERE code = OLD.room;
END;
