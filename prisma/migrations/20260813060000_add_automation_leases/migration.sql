CREATE TABLE IF NOT EXISTS `tochukwu_automation_leases` (
  `automation_key` VARCHAR(120) NOT NULL,
  `lease_token` VARCHAR(64) NOT NULL,
  `locked_until` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`automation_key`),
  KEY `idx_automation_lease_expiry` (`locked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
