SET @affiliate_onboarding_source_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'onboarding_source') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `onboarding_source` VARCHAR(40) NOT NULL DEFAULT ''student_dashboard'' AFTER `blocked_at`',
  'SELECT 1'
);
PREPARE affiliate_onboarding_source_statement FROM @affiliate_onboarding_source_sql;
EXECUTE affiliate_onboarding_source_statement;
DEALLOCATE PREPARE affiliate_onboarding_source_statement;

SET @affiliate_email_verified_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'email_verified_at') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `email_verified_at` DATETIME NULL AFTER `onboarding_source`',
  'SELECT 1'
);
PREPARE affiliate_email_verified_statement FROM @affiliate_email_verified_sql;
EXECUTE affiliate_email_verified_statement;
DEALLOCATE PREPARE affiliate_email_verified_statement;

SET @affiliate_terms_accepted_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'terms_accepted_at') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `terms_accepted_at` DATETIME NULL AFTER `email_verified_at`',
  'SELECT 1'
);
PREPARE affiliate_terms_accepted_statement FROM @affiliate_terms_accepted_sql;
EXECUTE affiliate_terms_accepted_statement;
DEALLOCATE PREPARE affiliate_terms_accepted_statement;

SET @affiliate_terms_version_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'terms_version') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `terms_version` VARCHAR(40) NULL AFTER `terms_accepted_at`',
  'SELECT 1'
);
PREPARE affiliate_terms_version_statement FROM @affiliate_terms_version_sql;
EXECUTE affiliate_terms_version_statement;
DEALLOCATE PREPARE affiliate_terms_version_statement;

SET @affiliate_activated_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'activated_at') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `activated_at` DATETIME NULL AFTER `terms_version`',
  'SELECT 1'
);
PREPARE affiliate_activated_statement FROM @affiliate_activated_sql;
EXECUTE affiliate_activated_statement;
DEALLOCATE PREPARE affiliate_activated_statement;

SET @affiliate_verification_hash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'verification_token_hash') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `verification_token_hash` VARCHAR(128) NULL AFTER `activated_at`',
  'SELECT 1'
);
PREPARE affiliate_verification_hash_statement FROM @affiliate_verification_hash_sql;
EXECUTE affiliate_verification_hash_statement;
DEALLOCATE PREPARE affiliate_verification_hash_statement;

SET @affiliate_verification_expiry_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND COLUMN_NAME = 'verification_expires_at') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD COLUMN `verification_expires_at` DATETIME NULL AFTER `verification_token_hash`',
  'SELECT 1'
);
PREPARE affiliate_verification_expiry_statement FROM @affiliate_verification_expiry_sql;
EXECUTE affiliate_verification_expiry_statement;
DEALLOCATE PREPARE affiliate_verification_expiry_statement;

SET @affiliate_verification_index_sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_affiliate_profiles'
     AND INDEX_NAME = 'uniq_tochukwu_affiliate_verification_token') = 0,
  'ALTER TABLE `tochukwu_affiliate_profiles` ADD UNIQUE INDEX `uniq_tochukwu_affiliate_verification_token` (`verification_token_hash`)',
  'SELECT 1'
);
PREPARE affiliate_verification_index_statement FROM @affiliate_verification_index_sql;
EXECUTE affiliate_verification_index_statement;
DEALLOCATE PREPARE affiliate_verification_index_statement;
