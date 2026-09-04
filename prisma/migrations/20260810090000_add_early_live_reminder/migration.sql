SET @early_reminder_send_at_sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tochukwu_course_batch_live_sessions'
     AND COLUMN_NAME = 'early_reminder_send_at') = 0,
  'ALTER TABLE `tochukwu_course_batch_live_sessions` ADD COLUMN `early_reminder_send_at` DATETIME NULL AFTER `reminder_send_at`',
  'SELECT 1'
);
PREPARE early_reminder_send_at_statement FROM @early_reminder_send_at_sql;
EXECUTE early_reminder_send_at_statement;
DEALLOCATE PREPARE early_reminder_send_at_statement;
