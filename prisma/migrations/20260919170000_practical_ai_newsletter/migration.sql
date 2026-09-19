CREATE TABLE IF NOT EXISTS `tochukwu_practical_ai_newsletter_campaigns` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `campaign_uuid` VARCHAR(64) NOT NULL,
  `recipient_email` VARCHAR(320) NOT NULL,
  `recipient_key` VARCHAR(64) NOT NULL,
  `recipient_name` VARCHAR(180) NULL,
  `started_at` DATETIME NOT NULL,
  `next_week` INT NOT NULL DEFAULT 1,
  `next_send_at` DATETIME NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `attempts` INT NOT NULL DEFAULT 0,
  `last_attempt_at` DATETIME NULL,
  `last_sent_at` DATETIME NULL,
  `last_error` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_practical_ai_newsletter_campaign_uuid` (`campaign_uuid`),
  UNIQUE KEY `uniq_practical_ai_newsletter_recipient` (`recipient_key`),
  KEY `idx_practical_ai_newsletter_due` (`status`, `next_send_at`),
  KEY `idx_practical_ai_newsletter_email` (`recipient_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tochukwu_practical_ai_newsletter_deliveries` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `delivery_uuid` VARCHAR(64) NOT NULL,
  `campaign_id` BIGINT NOT NULL,
  `recipient_email` VARCHAR(320) NOT NULL,
  `recipient_key` VARCHAR(64) NOT NULL,
  `week_number` INT NOT NULL,
  `content_key` VARCHAR(120) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'processing',
  `attempts` INT NOT NULL DEFAULT 1,
  `provider_message_id` VARCHAR(500) NULL,
  `last_error` VARCHAR(1000) NULL,
  `sent_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_practical_ai_newsletter_delivery_uuid` (`delivery_uuid`),
  UNIQUE KEY `uniq_practical_ai_newsletter_week` (`campaign_id`, `week_number`),
  KEY `idx_practical_ai_newsletter_delivery_status` (`status`, `created_at`),
  KEY `idx_practical_ai_newsletter_delivery_email` (`recipient_email`, `sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tochukwu_practical_ai_newsletter_preferences` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `recipient_email` VARCHAR(320) NOT NULL,
  `recipient_key` VARCHAR(64) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'active',
  `reason` VARCHAR(80) NULL,
  `updated_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_practical_ai_newsletter_preference` (`recipient_key`),
  KEY `idx_practical_ai_newsletter_preference_status` (`status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
