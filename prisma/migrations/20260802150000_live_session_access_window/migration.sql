ALTER TABLE `tochukwu_course_batch_live_sessions`
  ALTER COLUMN `reminder_minutes_before` SET DEFAULT 30;

UPDATE `tochukwu_course_batch_live_sessions`
SET `reminder_minutes_before` = 30,
    `reminder_send_at` = DATE_SUB(`starts_at`, INTERVAL 30 MINUTE),
    `updated_at` = NOW()
WHERE `reminder_minutes_before` <> 30
   OR `reminder_send_at` IS NULL
   OR `reminder_send_at` <> DATE_SUB(`starts_at`, INTERVAL 30 MINUTE);

-- The Holiday live classes are at 7:00 p.m. WAT. Align the seeded records with
-- the student message and the 30-minute dashboard access window at 6:30 p.m.
UPDATE `tochukwu_course_batch_live_sessions`
SET `starts_at` = TIMESTAMP(DATE(`starts_at`), '19:00:00'),
    `time_of_day` = '19:00',
    `reminder_minutes_before` = 30,
    `reminder_send_at` = TIMESTAMP(DATE(`starts_at`), '18:30:00'),
    `updated_at` = NOW()
WHERE `course_slug` = 'prompt-to-profit-holiday'
  AND `session_title` IN ('Day 1 Live Welcome Session', 'Day 5 Live Closing Session')
  AND TIME(`starts_at`) <> '19:00:00';
