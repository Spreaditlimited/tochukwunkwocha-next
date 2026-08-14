CREATE TABLE IF NOT EXISTS `tochukwu_advanced_upgrade_deliveries` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `delivery_uuid` VARCHAR(64) NOT NULL,
  `campaign_key` VARCHAR(80) NOT NULL,
  `recipient_email` VARCHAR(320) NOT NULL,
  `recipient_key` VARCHAR(64) NOT NULL,
  `recipient_name` VARCHAR(180) NULL,
  `recipient_role` VARCHAR(32) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `due_at` DATETIME NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `provider_message_id` VARCHAR(500) NULL,
  `last_error` VARCHAR(1000) NULL,
  `last_attempt_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_advanced_upgrade_delivery_uuid` (`delivery_uuid`),
  UNIQUE KEY `uniq_advanced_upgrade_recipient_send` (`campaign_key`, `recipient_key`),
  KEY `idx_advanced_upgrade_status_due` (`status`, `due_at`),
  KEY `idx_advanced_upgrade_recipient` (`recipient_email`, `sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tochukwu_advanced_upgrade_preferences` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `recipient_email` VARCHAR(320) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'active',
  `reason` VARCHAR(80) NULL,
  `updated_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_advanced_upgrade_preference_email` (`recipient_email`),
  KEY `idx_advanced_upgrade_preference_status` (`status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
