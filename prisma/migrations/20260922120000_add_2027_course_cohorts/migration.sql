ALTER TABLE `course_batches`
  ADD COLUMN `batch_end_at` DATETIME NULL AFTER `batch_start_at`;

INSERT INTO `course_batches`
  (`course_slug`, `batch_key`, `batch_label`, `status`, `is_active`, `paystack_reference_prefix`,
   `paystack_amount_minor`, `paypal_amount_minor`, `brevo_list_id`, `seat_limit`,
   `batch_start_at`, `batch_end_at`, `activated_at`, `created_at`, `updated_at`)
SELECT seed.course_slug, seed.batch_key, seed.batch_label, 'open', 0, seed.reference_prefix,
  COALESCE(course.price_ngn_minor, 0), COALESCE(course.price_gbp_minor, 0), NULL, NULL,
  seed.batch_start_at, seed.batch_end_at, NULL, NOW(), NOW()
FROM (
  SELECT 'prompt-to-profit' AS course_slug, 'ptp-2027-easter' AS batch_key, 'Easter Cohort' AS batch_label,
    'PTP27E' AS reference_prefix, TIMESTAMP('2027-04-19', '19:00:00') AS batch_start_at, TIMESTAMP('2027-04-23', '23:59:59') AS batch_end_at
  UNION ALL SELECT 'prompt-to-profit', 'ptp-2027-august-1', 'August Cohort 1', 'PTP27A1', TIMESTAMP('2027-08-02', '19:00:00'), TIMESTAMP('2027-08-06', '23:59:59')
  UNION ALL SELECT 'prompt-to-profit', 'ptp-2027-august-2', 'August Cohort 2', 'PTP27A2', TIMESTAMP('2027-08-09', '19:00:00'), TIMESTAMP('2027-08-13', '23:59:59')
  UNION ALL SELECT 'prompt-to-profit', 'ptp-2027-august-3', 'August Cohort 3', 'PTP27A3', TIMESTAMP('2027-08-16', '19:00:00'), TIMESTAMP('2027-08-20', '23:59:59')
  UNION ALL SELECT 'prompt-to-profit', 'ptp-2027-august-4', 'August Cohort 4', 'PTP27A4', TIMESTAMP('2027-08-23', '19:00:00'), TIMESTAMP('2027-08-27', '23:59:59')
  UNION ALL SELECT 'prompt-to-production', 'ptprod-2027-february', 'February Cohort', 'PTPR27F', TIMESTAMP('2027-02-06', '19:00:00'), TIMESTAMP('2027-02-27', '23:59:59')
  UNION ALL SELECT 'prompt-to-production', 'ptprod-2027-may', 'May Cohort', 'PTPR27M', TIMESTAMP('2027-05-01', '19:00:00'), TIMESTAMP('2027-05-22', '23:59:59')
  UNION ALL SELECT 'prompt-to-production', 'ptprod-2027-july', 'July Cohort', 'PTPR27J', TIMESTAMP('2027-07-03', '19:00:00'), TIMESTAMP('2027-07-24', '23:59:59')
  UNION ALL SELECT 'prompt-to-production', 'ptprod-2027-november', 'November Cohort', 'PTPR27N', TIMESTAMP('2027-11-06', '19:00:00'), TIMESTAMP('2027-11-27', '23:59:59')
) seed
LEFT JOIN `tochukwu_learning_courses` course
  ON course.course_slug = seed.course_slug
ON DUPLICATE KEY UPDATE
  `batch_label` = VALUES(`batch_label`),
  `status` = 'open',
  `paystack_reference_prefix` = VALUES(`paystack_reference_prefix`),
  `paystack_amount_minor` = VALUES(`paystack_amount_minor`),
  `paypal_amount_minor` = VALUES(`paypal_amount_minor`),
  `batch_start_at` = VALUES(`batch_start_at`),
  `batch_end_at` = VALUES(`batch_end_at`),
  `updated_at` = NOW();

-- Clone the working release pattern for each new cohort. Calendar-day offsets and
-- wall-clock release times are preserved independently of the cohort start time.
INSERT INTO `tochukwu_learning_module_batch_drips`
  (`module_id`, `batch_key`, `access_mode`, `drip_at`, `created_at`, `updated_at`)
SELECT source_drip.module_id, target.batch_key, source_drip.access_mode,
  CASE
    WHEN source_drip.access_mode = 'immediate' THEN source_drip.drip_at
    ELSE TIMESTAMP(
      DATE_ADD(DATE(target.batch_start_at), INTERVAL DATEDIFF(DATE(source_drip.drip_at), DATE(source_batch.batch_start_at)) DAY),
      TIME(source_drip.drip_at)
    )
  END,
  NOW(), NOW()
FROM `tochukwu_learning_module_batch_drips` source_drip
JOIN `course_batches` source_batch
  ON source_batch.course_slug = 'prompt-to-profit'
 AND source_batch.batch_key = 'ptp-batch-4'
JOIN `course_batches` target
  ON target.course_slug = 'prompt-to-profit'
 AND target.batch_key IN ('ptp-2027-easter', 'ptp-2027-august-1', 'ptp-2027-august-2', 'ptp-2027-august-3', 'ptp-2027-august-4')
WHERE source_drip.batch_key = 'ptp-batch-4'
ON DUPLICATE KEY UPDATE
  `access_mode` = VALUES(`access_mode`),
  `drip_at` = VALUES(`drip_at`),
  `updated_at` = NOW();

INSERT INTO `tochukwu_learning_module_batch_drips`
  (`module_id`, `batch_key`, `access_mode`, `drip_at`, `created_at`, `updated_at`)
SELECT source_drip.module_id, target.batch_key, source_drip.access_mode,
  CASE
    WHEN source_drip.access_mode = 'immediate' THEN source_drip.drip_at
    ELSE TIMESTAMP(
      DATE_ADD(DATE(target.batch_start_at), INTERVAL DATEDIFF(DATE(source_drip.drip_at), DATE(source_batch.batch_start_at)) DAY),
      TIME(source_drip.drip_at)
    )
  END,
  NOW(), NOW()
FROM `tochukwu_learning_module_batch_drips` source_drip
JOIN `course_batches` source_batch
  ON source_batch.course_slug = 'prompt-to-production'
 AND source_batch.batch_key = 'ptprod-batch-1'
JOIN `course_batches` target
  ON target.course_slug = 'prompt-to-production'
 AND target.batch_key IN ('ptprod-2027-february', 'ptprod-2027-may', 'ptprod-2027-july', 'ptprod-2027-november')
WHERE source_drip.batch_key = 'ptprod-batch-1'
ON DUPLICATE KEY UPDATE
  `access_mode` = VALUES(`access_mode`),
  `drip_at` = VALUES(`drip_at`),
  `updated_at` = NOW();

-- Create the dated live-class shells without sending reminders or creating Zoom
-- meetings. Admins can attach each cohort's Zoom room before reminders are enabled.
INSERT INTO `tochukwu_course_batch_live_sessions`
  (`session_uuid`, `course_slug`, `batch_key`, `batch_label`, `session_title`, `day_offset`, `time_of_day`, `starts_at`,
   `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url`, `is_visible`, `reminder_enabled`, `reminder_minutes_before`,
   `reminder_send_at`, `early_reminder_send_at`, `reminder_sent_at`, `reminder_last_error`, `created_at`, `updated_at`)
SELECT CONCAT('live_', REPLACE(seed.batch_key, '-', '_'), '_day1'), seed.course_slug, seed.batch_key, seed.batch_label,
  'Day 1 Live Welcome Session', 0, '19:00', seed.batch_start_at,
  NULL, NULL, NULL, 1, 0, 30, DATE_SUB(seed.batch_start_at, INTERVAL 30 MINUTE), NULL, NULL, NULL, NOW(), NOW()
FROM `course_batches` seed
WHERE seed.course_slug = 'prompt-to-profit'
  AND seed.batch_key IN ('ptp-2027-easter', 'ptp-2027-august-1', 'ptp-2027-august-2', 'ptp-2027-august-3', 'ptp-2027-august-4')
UNION ALL
SELECT CONCAT('live_', REPLACE(seed.batch_key, '-', '_'), '_day5'), seed.course_slug, seed.batch_key, seed.batch_label,
  'Day 5 Live Closing Session', 4, '19:00', DATE_ADD(seed.batch_start_at, INTERVAL 4 DAY),
  NULL, NULL, NULL, 1, 0, 30, DATE_SUB(DATE_ADD(seed.batch_start_at, INTERVAL 4 DAY), INTERVAL 30 MINUTE), NULL, NULL, NULL, NOW(), NOW()
FROM `course_batches` seed
WHERE seed.course_slug = 'prompt-to-profit'
  AND seed.batch_key IN ('ptp-2027-easter', 'ptp-2027-august-1', 'ptp-2027-august-2', 'ptp-2027-august-3', 'ptp-2027-august-4')
ON DUPLICATE KEY UPDATE
  `batch_label` = VALUES(`batch_label`),
  `starts_at` = VALUES(`starts_at`),
  `reminder_send_at` = VALUES(`reminder_send_at`),
  `updated_at` = NOW();

INSERT INTO `tochukwu_course_batch_live_sessions`
  (`session_uuid`, `course_slug`, `batch_key`, `batch_label`, `session_title`, `day_offset`, `time_of_day`, `starts_at`,
   `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url`, `is_visible`, `reminder_enabled`, `reminder_minutes_before`,
   `reminder_send_at`, `early_reminder_send_at`, `reminder_sent_at`, `reminder_last_error`, `created_at`, `updated_at`)
SELECT CONCAT('live_', REPLACE(seed.batch_key, '-', '_'), '_week', weeks.week_number), seed.course_slug, seed.batch_key, seed.batch_label,
  CONCAT('Week ', weeks.week_number, ' Live Class'), (weeks.week_number - 1) * 7, '19:00', TIMESTAMPADD(DAY, (weeks.week_number - 1) * 7, seed.batch_start_at),
  NULL, NULL, NULL, 1, 0, 30, DATE_SUB(TIMESTAMPADD(DAY, (weeks.week_number - 1) * 7, seed.batch_start_at), INTERVAL 30 MINUTE), NULL, NULL, NULL, NOW(), NOW()
FROM `course_batches` seed
CROSS JOIN (
  SELECT 1 AS week_number UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
) weeks
WHERE seed.course_slug = 'prompt-to-production'
  AND seed.batch_key IN ('ptprod-2027-february', 'ptprod-2027-may', 'ptprod-2027-july', 'ptprod-2027-november')
ON DUPLICATE KEY UPDATE
  `batch_label` = VALUES(`batch_label`),
  `starts_at` = VALUES(`starts_at`),
  `reminder_send_at` = VALUES(`reminder_send_at`),
  `updated_at` = NOW();
