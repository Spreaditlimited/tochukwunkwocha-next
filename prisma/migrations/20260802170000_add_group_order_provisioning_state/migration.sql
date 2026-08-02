CREATE TABLE IF NOT EXISTS `tochukwu_group_order_provisioning_state` (
  `order_uuid` VARCHAR(64) NOT NULL,
  `provider` VARCHAR(40) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `first_detected_at` DATETIME NOT NULL,
  `locked_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `last_error` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`order_uuid`),
  KEY `idx_group_order_provisioning_status` (`status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
