SET @notification_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_notification_outbox' AND COLUMN_NAME = 'brevo_synced_at') = 0, 'ADD COLUMN `brevo_synced_at` DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_notification_outbox' AND COLUMN_NAME = 'brevo_status') = 0, 'ADD COLUMN `brevo_status` VARCHAR(24) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_notification_outbox' AND COLUMN_NAME = 'email_status') = 0, 'ADD COLUMN `email_status` VARCHAR(24) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_notification_outbox' AND COLUMN_NAME = 'whatsapp_status') = 0, 'ADD COLUMN `whatsapp_status` VARCHAR(24) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_notification_outbox' AND COLUMN_NAME = 'email_message_id') = 0, 'ADD COLUMN `email_message_id` VARCHAR(500) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_notification_outbox' AND COLUMN_NAME = 'whatsapp_message_id') = 0, 'ADD COLUMN `whatsapp_message_id` VARCHAR(500) NULL', NULL)
);
SET @notification_sql = IF(@notification_columns = '', 'SELECT 1', CONCAT('ALTER TABLE `tochukwu_notification_outbox` ', @notification_columns));
PREPARE notification_statement FROM @notification_sql;
EXECUTE notification_statement;
DEALLOCATE PREPARE notification_statement;
