CREATE TABLE IF NOT EXISTS `tochukwu_course_enrollment_claims` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email_key` VARCHAR(190) NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `source_type` VARCHAR(40) NOT NULL,
  `source_uuid` VARCHAR(80) NOT NULL,
  `batch_key` VARCHAR(64) NULL,
  `batch_label` VARCHAR(120) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_enrollment_claim_email_course` (`email_key`, `course_slug`),
  UNIQUE KEY `uniq_tochukwu_enrollment_claim_source` (`source_type`, `source_uuid`),
  KEY `idx_tochukwu_enrollment_claim_course` (`course_slug`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
