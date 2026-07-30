CREATE TABLE IF NOT EXISTS `tochukwu_admin_settings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(120) NOT NULL,
  `setting_value` LONGTEXT NULL,
  `updated_by` VARCHAR(80) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_admin_settings_audit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(120) NOT NULL,
  `action_type` VARCHAR(20) NOT NULL,
  `old_is_set` TINYINT(1) NOT NULL DEFAULT 0,
  `new_is_set` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_by` VARCHAR(80) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_setting_audit_key_created` (`setting_key`, `created_at`),
  KEY `idx_setting_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_profiles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `profile_uuid` VARCHAR(64) NOT NULL,
  `account_id` BIGINT NOT NULL,
  `affiliate_code` VARCHAR(40) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `eligibility_status` VARCHAR(40) NOT NULL DEFAULT 'eligible',
  `eligibility_reason` VARCHAR(190) NULL,
  `country_code` VARCHAR(2) NOT NULL DEFAULT 'NG',
  `payout_currency` VARCHAR(10) NOT NULL DEFAULT 'NGN',
  `payout_provider` VARCHAR(40) NOT NULL DEFAULT 'paystack',
  `risk_level` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `blocked_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_affiliate_profile_uuid` (`profile_uuid`),
  UNIQUE KEY `uniq_tochukwu_affiliate_profile_account` (`account_id`),
  UNIQUE KEY `uniq_tochukwu_affiliate_code` (`affiliate_code`),
  KEY `idx_tochukwu_affiliate_profile_status` (`status`, `eligibility_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_course_rules` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `course_slug` VARCHAR(120) NOT NULL,
  `is_affiliate_eligible` TINYINT(1) NOT NULL DEFAULT 0,
  `commission_type` VARCHAR(20) NOT NULL DEFAULT 'percentage',
  `commission_value` INT NOT NULL DEFAULT 0,
  `commission_currency` VARCHAR(10) NOT NULL DEFAULT 'NGN',
  `min_order_amount_minor` INT NOT NULL DEFAULT 0,
  `hold_days` INT NOT NULL DEFAULT 30,
  `starts_at` DATETIME NULL,
  `ends_at` DATETIME NULL,
  `updated_by` VARCHAR(120) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_course_rule_slug` (`course_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_attributions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `attribution_uuid` VARCHAR(64) NOT NULL,
  `order_uuid` VARCHAR(64) NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `affiliate_profile_id` BIGINT NULL,
  `affiliate_code` VARCHAR(40) NULL,
  `buyer_email` VARCHAR(220) NOT NULL,
  `buyer_account_id` BIGINT NULL,
  `buyer_country` VARCHAR(120) NULL,
  `buyer_currency` VARCHAR(10) NULL,
  `order_amount_minor` INT NOT NULL DEFAULT 0,
  `ip_hash` VARCHAR(128) NULL,
  `user_agent_hash` VARCHAR(128) NULL,
  `click_referrer` VARCHAR(255) NULL,
  `attribution_status` VARCHAR(40) NOT NULL DEFAULT 'accepted',
  `rejection_reason` VARCHAR(190) NULL,
  `risk_score` INT NOT NULL DEFAULT 0,
  `risk_flags_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_attr_uuid` (`attribution_uuid`),
  UNIQUE KEY `uniq_tochukwu_aff_attr_order` (`order_uuid`),
  KEY `idx_tochukwu_aff_attr_profile` (`affiliate_profile_id`, `created_at`),
  KEY `idx_tochukwu_aff_attr_buyer_email` (`buyer_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_audit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_uuid` VARCHAR(64) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `actor_type` VARCHAR(40) NOT NULL DEFAULT 'system',
  `actor_id` VARCHAR(120) NULL,
  `target_type` VARCHAR(60) NULL,
  `target_id` VARCHAR(120) NULL,
  `metadata_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_audit_uuid` (`event_uuid`),
  KEY `idx_tochukwu_aff_audit_type_created` (`event_type`, `created_at`),
  KEY `idx_tochukwu_aff_audit_target` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_notification_outbox` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_uuid` VARCHAR(64) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `source_uuid` VARCHAR(100) NOT NULL,
  `payload_encrypted` LONGTEXT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME NOT NULL,
  `locked_at` DATETIME NULL,
  `email_sent_at` DATETIME NULL,
  `whatsapp_sent_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `last_error` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_notification_event` (`event_uuid`),
  KEY `idx_tochukwu_notification_pending` (`status`, `next_attempt_at`),
  KEY `idx_tochukwu_notification_source` (`source_uuid`, `event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @course_order_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'fbp') = 0, 'ADD COLUMN `fbp` VARCHAR(190) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'fbc') = 0, 'ADD COLUMN `fbc` VARCHAR(190) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'fbclid') = 0, 'ADD COLUMN `fbclid` TEXT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'client_ip') = 0, 'ADD COLUMN `client_ip` VARCHAR(80) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'user_agent') = 0, 'ADD COLUMN `user_agent` VARCHAR(500) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'family_account_id') = 0, 'ADD COLUMN `family_account_id` BIGINT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'affiliate_code') = 0, 'ADD COLUMN `affiliate_code` VARCHAR(40) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'affiliate_profile_id') = 0, 'ADD COLUMN `affiliate_profile_id` BIGINT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_orders' AND COLUMN_NAME = 'affiliate_attribution_status') = 0, 'ADD COLUMN `affiliate_attribution_status` VARCHAR(40) NULL', NULL)
);
SET @course_order_sql = IF(@course_order_columns = '', 'SELECT 1', CONCAT('ALTER TABLE `course_orders` ', @course_order_columns));
PREPARE checkout_course_order_statement FROM @course_order_sql;
EXECUTE checkout_course_order_statement;
DEALLOCATE PREPARE checkout_course_order_statement;

SET @manual_payment_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'fbp') = 0, 'ADD COLUMN `fbp` VARCHAR(190) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'fbc') = 0, 'ADD COLUMN `fbc` VARCHAR(190) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'fbclid') = 0, 'ADD COLUMN `fbclid` TEXT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'client_ip') = 0, 'ADD COLUMN `client_ip` VARCHAR(80) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'user_agent') = 0, 'ADD COLUMN `user_agent` VARCHAR(500) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'family_account_id') = 0, 'ADD COLUMN `family_account_id` BIGINT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'affiliate_code') = 0, 'ADD COLUMN `affiliate_code` VARCHAR(40) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'affiliate_profile_id') = 0, 'ADD COLUMN `affiliate_profile_id` BIGINT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_manual_payments' AND COLUMN_NAME = 'affiliate_attribution_status') = 0, 'ADD COLUMN `affiliate_attribution_status` VARCHAR(40) NULL', NULL)
);
SET @manual_payment_sql = IF(@manual_payment_columns = '', 'SELECT 1', CONCAT('ALTER TABLE `course_manual_payments` ', @manual_payment_columns));
PREPARE checkout_manual_payment_statement FROM @manual_payment_sql;
EXECUTE checkout_manual_payment_statement;
DEALLOCATE PREPARE checkout_manual_payment_statement;
