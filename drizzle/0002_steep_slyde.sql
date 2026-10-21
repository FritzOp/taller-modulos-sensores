CREATE TABLE `sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`remote_id` text NOT NULL,
	`storage_path` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
DROP INDEX `albums_name_unique`;--> statement-breakpoint
ALTER TABLE `albums` ADD `user_id` text DEFAULT 'local_guest' NOT NULL;--> statement-breakpoint
ALTER TABLE `albums` ADD `remote_id` text;--> statement-breakpoint
ALTER TABLE `albums` ADD `sync_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `user_id` text DEFAULT 'local_guest' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `remote_id` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `remote_url` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `sync_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `last_synced_at` integer;