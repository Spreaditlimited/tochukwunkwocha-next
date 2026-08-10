ALTER TABLE `tochukwu_course_batch_live_sessions`
  ADD COLUMN IF NOT EXISTS `early_reminder_send_at` DATETIME NULL AFTER `reminder_send_at`;
