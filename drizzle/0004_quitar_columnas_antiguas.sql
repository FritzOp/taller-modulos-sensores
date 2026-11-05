DROP TABLE `sync_queue`;--> statement-breakpoint
ALTER TABLE `albums` DROP COLUMN `remote_id`;--> statement-breakpoint
ALTER TABLE `albums` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `photos` DROP COLUMN `remote_id`;--> statement-breakpoint
ALTER TABLE `photos` DROP COLUMN `remote_url`;--> statement-breakpoint
ALTER TABLE `photos` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `photos` DROP COLUMN `last_synced_at`;