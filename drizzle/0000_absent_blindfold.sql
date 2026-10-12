CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uri` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`created_at` integer NOT NULL,
	`source` text NOT NULL
);
