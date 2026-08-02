CREATE TABLE IF NOT EXISTS `tochukwu_course_live_session_reminder_deliveries` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_uuid` VARCHAR(64) NOT NULL,
  `reminder_stage` VARCHAR(32) NOT NULL,
  `recipient_key` VARCHAR(320) NOT NULL,
  `channel` VARCHAR(24) NOT NULL,
  `destination` VARCHAR(500) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `provider_message_id` VARCHAR(500) NULL,
  `last_error` VARCHAR(500) NULL,
  `last_attempt_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_live_reminder_delivery` (`session_uuid`, `reminder_stage`, `recipient_key`, `channel`),
  KEY `idx_tochukwu_live_reminder_delivery_status` (`status`, `last_attempt_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
