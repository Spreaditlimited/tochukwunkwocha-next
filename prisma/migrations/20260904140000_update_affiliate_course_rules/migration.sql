-- Keep affiliate course eligibility and fixed commissions in one authoritative table.
-- Amounts are stored in minor units: NGN 5,000 = 500000; NGN 25,000 = 2500000.
INSERT INTO `tochukwu_affiliate_course_rules`
  (`course_slug`, `is_affiliate_eligible`, `commission_type`, `commission_value`,
   `commission_currency`, `min_order_amount_minor`, `hold_days`, `starts_at`, `ends_at`,
   `updated_by`, `created_at`, `updated_at`)
VALUES
  ('prompt-to-profit', 1, 'fixed', 500000, 'NGN', 0, 30, NULL, NULL,
   'system:affiliate-course-rule-update', UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  ('prompt-to-profit-holiday', 0, 'fixed', 0, 'NGN', 0, 30, NULL, NULL,
   'system:affiliate-course-rule-update', UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  ('prompt-to-production', 1, 'fixed', 2500000, 'NGN', 0, 30, NULL, NULL,
   'system:affiliate-course-rule-update', UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  `is_affiliate_eligible` = VALUES(`is_affiliate_eligible`),
  `commission_type` = VALUES(`commission_type`),
  `commission_value` = VALUES(`commission_value`),
  `commission_currency` = VALUES(`commission_currency`),
  `min_order_amount_minor` = VALUES(`min_order_amount_minor`),
  `hold_days` = VALUES(`hold_days`),
  `starts_at` = VALUES(`starts_at`),
  `ends_at` = VALUES(`ends_at`),
  `updated_by` = VALUES(`updated_by`),
  `updated_at` = VALUES(`updated_at`);
