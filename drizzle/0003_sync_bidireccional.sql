CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `photos` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `remote_path` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `synced_at` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `deleted_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `photos_client_id_unique` ON `photos` (`client_id`);--> statement-breakpoint
-- Identidad compartida: las fotos ya respaldadas conservan su id remoto; las demás reciben un UUID nuevo.
-- Todas quedan pendientes (synced_at y remote_path vacíos): subir de nuevo es idempotente.
UPDATE `photos` SET
	`client_id` = coalesce(
		`remote_id`,
		lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
		substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) ||
		substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
	),
	`updated_at` = CASE
		WHEN `sync_status` = 'synced' THEN coalesce(`last_synced_at`, `created_at`)
		ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000
	END;
--> statement-breakpoint
-- Los borrados que seguían en la cola antigua pasan a ser marcas de borrado pendientes de subir.
INSERT OR IGNORE INTO `photos` (`user_id`, `uri`, `source`, `created_at`, `client_id`, `updated_at`, `remote_path`, `deleted_at`)
SELECT
	`user_id`, '', 'camera', `created_at`, `remote_id`,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000,
	`storage_path`,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `sync_queue`
WHERE `entity_type` = 'photo';
