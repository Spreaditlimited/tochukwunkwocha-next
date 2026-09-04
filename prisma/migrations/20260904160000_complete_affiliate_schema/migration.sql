-- Affiliate runtime code assumes this schema has already been migrated.
-- Keep all affiliate DDL here so application requests never create or alter tables.

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_commissions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `commission_uuid` VARCHAR(64) NOT NULL,
  `attribution_id` BIGINT NOT NULL,
  `order_uuid` VARCHAR(64) NOT NULL,
  `seat_number` INT NOT NULL DEFAULT 1,
  `seat_count` INT NOT NULL DEFAULT 1,
  `course_slug` VARCHAR(120) NOT NULL,
  `affiliate_profile_id` BIGINT NOT NULL,
  `affiliate_code` VARCHAR(40) NOT NULL,
  `buyer_email` VARCHAR(220) NOT NULL,
  `currency` VARCHAR(10) NOT NULL,
  `order_amount_minor` INT NOT NULL DEFAULT 0,
  `commission_type` VARCHAR(20) NOT NULL,
  `commission_rate_or_value` INT NOT NULL DEFAULT 0,
  `commission_amount_minor` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `risk_score` INT NOT NULL DEFAULT 0,
  `risk_flags_json` LONGTEXT NULL,
  `payable_at` DATETIME NULL,
  `paid_at` DATETIME NULL,
  `reversed_at` DATETIME NULL,
  `reversal_reason` VARCHAR(190) NULL,
  `payout_batch_id` BIGINT NULL,
  `payout_item_id` BIGINT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_commission_uuid` (`commission_uuid`),
  UNIQUE KEY `uniq_tochukwu_aff_commission_order_seat` (`order_uuid`, `seat_number`),
  KEY `idx_tochukwu_aff_commission_profile` (`affiliate_profile_id`, `status`, `payable_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_payout_accounts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `account_uuid` VARCHAR(64) NOT NULL,
  `affiliate_profile_id` BIGINT NOT NULL,
  `country_code` VARCHAR(2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL,
  `payout_provider` VARCHAR(40) NOT NULL,
  `account_name` VARCHAR(180) NULL,
  `bank_code` VARCHAR(40) NULL,
  `bank_name` VARCHAR(120) NULL,
  `account_number_masked` VARCHAR(40) NULL,
  `account_number_hash` VARCHAR(128) NULL,
  `paystack_recipient_code` VARCHAR(120) NULL,
  `payout_email` VARCHAR(220) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_payout_account_uuid` (`account_uuid`),
  KEY `idx_tochukwu_aff_payout_profile` (`affiliate_profile_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_payout_batches` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `batch_uuid` VARCHAR(64) NOT NULL,
  `country_code` VARCHAR(2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL,
  `payout_provider` VARCHAR(40) NOT NULL,
  `period_start` DATETIME NOT NULL,
  `period_end` DATETIME NOT NULL,
  `scheduled_for` DATE NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'processing',
  `total_items` INT NOT NULL DEFAULT 0,
  `total_amount_minor` BIGINT NOT NULL DEFAULT 0,
  `paid_amount_minor` BIGINT NOT NULL DEFAULT 0,
  `successful_items` INT NOT NULL DEFAULT 0,
  `pending_items` INT NOT NULL DEFAULT 0,
  `otp_items` INT NOT NULL DEFAULT 0,
  `failed_items` INT NOT NULL DEFAULT 0,
  `run_notes` VARCHAR(255) NULL,
  `initiated_by` VARCHAR(120) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `completed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_payout_batch_uuid` (`batch_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_payout_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `item_uuid` VARCHAR(64) NOT NULL,
  `transfer_group_uuid` VARCHAR(64) NULL,
  `payout_batch_id` BIGINT NOT NULL,
  `commission_id` BIGINT NOT NULL,
  `affiliate_profile_id` BIGINT NOT NULL,
  `payout_account_id` BIGINT NULL,
  `amount_minor` INT NOT NULL DEFAULT 0,
  `currency` VARCHAR(10) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'processing',
  `provider_transfer_id` VARCHAR(190) NULL,
  `provider_transfer_code` VARCHAR(120) NULL,
  `provider_reference` VARCHAR(190) NULL,
  `provider_status` VARCHAR(40) NULL,
  `provider_domain` VARCHAR(20) NULL,
  `provider_message` VARCHAR(255) NULL,
  `error_message` VARCHAR(255) NULL,
  `processed_at` DATETIME NULL,
  `initiated_at` DATETIME NULL,
  `settled_at` DATETIME NULL,
  `last_verified_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_payout_item_uuid` (`item_uuid`),
  UNIQUE KEY `uniq_tochukwu_aff_payout_batch_commission` (`payout_batch_id`, `commission_id`),
  KEY `idx_tochukwu_aff_payout_reference` (`provider_reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @affiliate_commission_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_commissions' AND COLUMN_NAME = 'seat_number') = 0, 'ADD COLUMN `seat_number` INT NOT NULL DEFAULT 1 AFTER `order_uuid`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_commissions' AND COLUMN_NAME = 'seat_count') = 0, 'ADD COLUMN `seat_count` INT NOT NULL DEFAULT 1 AFTER `seat_number`', NULL)
);
SET @affiliate_commission_sql = IF(
  @affiliate_commission_columns = '',
  'SELECT 1',
  CONCAT('ALTER TABLE `tochukwu_affiliate_commissions` ', @affiliate_commission_columns)
);
PREPARE affiliate_commission_statement FROM @affiliate_commission_sql;
EXECUTE affiliate_commission_statement;
DEALLOCATE PREPARE affiliate_commission_statement;

SET @legacy_commission_index_found = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
    AND INDEX_NAME = 'uniq_tochukwu_aff_commission_order'
);
SET @drop_legacy_commission_index_sql = IF(
  @legacy_commission_index_found > 0,
  'ALTER TABLE `tochukwu_affiliate_commissions` DROP INDEX `uniq_tochukwu_aff_commission_order`',
  'SELECT 1'
);
PREPARE drop_legacy_commission_index_statement FROM @drop_legacy_commission_index_sql;
EXECUTE drop_legacy_commission_index_statement;
DEALLOCATE PREPARE drop_legacy_commission_index_statement;

SET @commission_seat_index_found = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
    AND INDEX_NAME = 'uniq_tochukwu_aff_commission_order_seat'
);
SET @commission_seat_index_sql = IF(
  @commission_seat_index_found = 0,
  'ALTER TABLE `tochukwu_affiliate_commissions` ADD UNIQUE INDEX `uniq_tochukwu_aff_commission_order_seat` (`order_uuid`, `seat_number`)',
  'SELECT 1'
);
PREPARE commission_seat_index_statement FROM @commission_seat_index_sql;
EXECUTE commission_seat_index_statement;
DEALLOCATE PREPARE commission_seat_index_statement;

SET @affiliate_payout_batch_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_batches' AND COLUMN_NAME = 'paid_amount_minor') = 0, 'ADD COLUMN `paid_amount_minor` BIGINT NOT NULL DEFAULT 0 AFTER `total_amount_minor`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_batches' AND COLUMN_NAME = 'pending_items') = 0, 'ADD COLUMN `pending_items` INT NOT NULL DEFAULT 0 AFTER `successful_items`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_batches' AND COLUMN_NAME = 'otp_items') = 0, 'ADD COLUMN `otp_items` INT NOT NULL DEFAULT 0 AFTER `pending_items`', NULL)
);
SET @affiliate_payout_batch_sql = IF(
  @affiliate_payout_batch_columns = '',
  'SELECT 1',
  CONCAT('ALTER TABLE `tochukwu_affiliate_payout_batches` ', @affiliate_payout_batch_columns)
);
PREPARE affiliate_payout_batch_statement FROM @affiliate_payout_batch_sql;
EXECUTE affiliate_payout_batch_statement;
DEALLOCATE PREPARE affiliate_payout_batch_statement;

SET @affiliate_payout_item_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'transfer_group_uuid') = 0, 'ADD COLUMN `transfer_group_uuid` VARCHAR(64) NULL AFTER `item_uuid`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'provider_status') = 0, 'ADD COLUMN `provider_status` VARCHAR(40) NULL AFTER `provider_reference`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'provider_domain') = 0, 'ADD COLUMN `provider_domain` VARCHAR(20) NULL AFTER `provider_status`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'provider_message') = 0, 'ADD COLUMN `provider_message` VARCHAR(255) NULL AFTER `provider_domain`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'initiated_at') = 0, 'ADD COLUMN `initiated_at` DATETIME NULL AFTER `processed_at`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'settled_at') = 0, 'ADD COLUMN `settled_at` DATETIME NULL AFTER `initiated_at`', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_affiliate_payout_items' AND COLUMN_NAME = 'last_verified_at') = 0, 'ADD COLUMN `last_verified_at` DATETIME NULL AFTER `settled_at`', NULL)
);
SET @affiliate_payout_item_sql = IF(
  @affiliate_payout_item_columns = '',
  'SELECT 1',
  CONCAT('ALTER TABLE `tochukwu_affiliate_payout_items` ', @affiliate_payout_item_columns)
);
PREPARE affiliate_payout_item_statement FROM @affiliate_payout_item_sql;
EXECUTE affiliate_payout_item_statement;
DEALLOCATE PREPARE affiliate_payout_item_statement;

SET @legacy_payout_item_index_found = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_payout_items'
    AND INDEX_NAME = 'uniq_tochukwu_aff_payout_item_commission'
);
SET @drop_legacy_payout_item_index_sql = IF(
  @legacy_payout_item_index_found > 0,
  'ALTER TABLE `tochukwu_affiliate_payout_items` DROP INDEX `uniq_tochukwu_aff_payout_item_commission`',
  'SELECT 1'
);
PREPARE drop_legacy_payout_item_index_statement FROM @drop_legacy_payout_item_index_sql;
EXECUTE drop_legacy_payout_item_index_statement;
DEALLOCATE PREPARE drop_legacy_payout_item_index_statement;

SET @payout_batch_commission_index_found = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_payout_items'
    AND INDEX_NAME = 'uniq_tochukwu_aff_payout_batch_commission'
);
SET @payout_batch_commission_index_sql = IF(
  @payout_batch_commission_index_found = 0,
  'ALTER TABLE `tochukwu_affiliate_payout_items` ADD UNIQUE INDEX `uniq_tochukwu_aff_payout_batch_commission` (`payout_batch_id`, `commission_id`)',
  'SELECT 1'
);
PREPARE payout_batch_commission_index_statement FROM @payout_batch_commission_index_sql;
EXECUTE payout_batch_commission_index_statement;
DEALLOCATE PREPARE payout_batch_commission_index_statement;

SET @payout_reference_index_found = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_payout_items'
    AND INDEX_NAME = 'idx_tochukwu_aff_payout_reference'
);
SET @payout_reference_index_sql = IF(
  @payout_reference_index_found = 0,
  'ALTER TABLE `tochukwu_affiliate_payout_items` ADD INDEX `idx_tochukwu_aff_payout_reference` (`provider_reference`)',
  'SELECT 1'
);
PREPARE payout_reference_index_statement FROM @payout_reference_index_sql;
EXECUTE payout_reference_index_statement;
DEALLOCATE PREPARE payout_reference_index_statement;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_payout_change_otps` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `otp_uuid` VARCHAR(64) NOT NULL,
  `affiliate_profile_id` BIGINT NOT NULL,
  `country_code` VARCHAR(2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL,
  `payout_provider` VARCHAR(40) NOT NULL,
  `target_bank_code` VARCHAR(40) NOT NULL,
  `target_account_hash` VARCHAR(128) NOT NULL,
  `target_account_masked` VARCHAR(40) NULL,
  `sent_to_email` VARCHAR(220) NOT NULL,
  `otp_hash` VARCHAR(128) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 5,
  `expires_at` DATETIME NOT NULL,
  `verified_at` DATETIME NULL,
  `consumed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_payout_otp_uuid` (`otp_uuid`),
  KEY `idx_tochukwu_aff_payout_otp_profile` (`affiliate_profile_id`, `status`, `expires_at`),
  KEY `idx_tochukwu_aff_payout_otp_target` (`affiliate_profile_id`, `target_bank_code`, `target_account_hash`, `status`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_affiliate_school_referrals` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `referral_uuid` VARCHAR(64) NOT NULL,
  `school_id` BIGINT NOT NULL,
  `affiliate_profile_id` BIGINT NOT NULL,
  `affiliate_code` VARCHAR(40) NOT NULL,
  `first_order_uuid` VARCHAR(64) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_aff_school_ref_uuid` (`referral_uuid`),
  UNIQUE KEY `uniq_tochukwu_aff_school_ref_school` (`school_id`),
  KEY `idx_tochukwu_aff_school_ref_affiliate` (`affiliate_profile_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @school_order_affiliate_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_orders' AND COLUMN_NAME = 'affiliate_code') = 0, 'ADD COLUMN `affiliate_code` VARCHAR(40) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_orders' AND COLUMN_NAME = 'affiliate_profile_id') = 0, 'ADD COLUMN `affiliate_profile_id` BIGINT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_orders' AND COLUMN_NAME = 'affiliate_attribution_status') = 0, 'ADD COLUMN `affiliate_attribution_status` VARCHAR(40) NULL', NULL)
);
SET @school_order_affiliate_sql = IF(
  @school_order_affiliate_columns = '',
  'SELECT 1',
  CONCAT('ALTER TABLE `school_orders` ', @school_order_affiliate_columns)
);
PREPARE school_order_affiliate_statement FROM @school_order_affiliate_sql;
EXECUTE school_order_affiliate_statement;
DEALLOCATE PREPARE school_order_affiliate_statement;

INSERT INTO `tochukwu_affiliate_course_rules`
  (`course_slug`, `is_affiliate_eligible`, `commission_type`, `commission_value`,
   `commission_currency`, `min_order_amount_minor`, `hold_days`, `created_at`, `updated_at`)
VALUES
  ('prompt-to-profit-schools', 1, 'percentage', 1000, 'NGN', 0, 30, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);
