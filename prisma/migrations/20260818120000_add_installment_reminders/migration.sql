CREATE TABLE IF NOT EXISTS `tochukwu_installment_reminders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `plan_id` BIGINT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `reminder_count` INTEGER NOT NULL DEFAULT 0,
  `next_reminder_at` DATETIME NOT NULL,
  `last_reminder_at` DATETIME NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `locked_at` DATETIME NULL,
  `stopped_at` DATETIME NULL,
  `stopped_reason` VARCHAR(80) NULL,
  `last_error` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_installment_reminder_plan` (`plan_id`),
  KEY `idx_tochukwu_installment_reminder_due` (`status`, `next_reminder_at`),
  KEY `idx_tochukwu_installment_reminder_lock` (`status`, `locked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
