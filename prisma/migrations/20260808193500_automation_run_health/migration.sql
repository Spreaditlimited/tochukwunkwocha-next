CREATE TABLE IF NOT EXISTS `tochukwu_automation_runs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `run_uuid` VARCHAR(64) NOT NULL,
  `automation_key` VARCHAR(120) NOT NULL,
  `status` VARCHAR(24) NOT NULL,
  `result_json` LONGTEXT NULL,
  `last_error` VARCHAR(1000) NULL,
  `started_at` DATETIME NOT NULL,
  `finished_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_automation_run_uuid` (`run_uuid`),
  KEY `idx_automation_run_key_started` (`automation_key`, `started_at`),
  KEY `idx_automation_run_status` (`status`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
