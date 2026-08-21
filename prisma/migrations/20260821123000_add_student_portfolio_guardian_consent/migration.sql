SET @guardian_consent_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'student_public_profiles'
     AND COLUMN_NAME = 'guardian_consent_confirmed') = 0,
  'ALTER TABLE `student_public_profiles` ADD COLUMN `guardian_consent_confirmed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `profile_picture_consent`',
  'SELECT 1'
);
PREPARE guardian_consent_statement FROM @guardian_consent_sql;
EXECUTE guardian_consent_statement;
DEALLOCATE PREPARE guardian_consent_statement;
