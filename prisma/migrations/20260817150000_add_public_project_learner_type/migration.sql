SET @public_project_learner_type_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'student_accounts'
     AND COLUMN_NAME = 'public_project_learner_type') = 0,
  'ALTER TABLE `student_accounts` ADD COLUMN `public_project_learner_type` VARCHAR(24) NULL',
  'SELECT 1'
);
PREPARE public_project_learner_type_statement FROM @public_project_learner_type_sql;
EXECUTE public_project_learner_type_statement;
DEALLOCATE PREPARE public_project_learner_type_statement;
