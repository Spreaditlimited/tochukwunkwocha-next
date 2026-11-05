-- Separate enrollment identities preserve existing live enrollments and communications.
-- The player resolves these keys to the original cohort's curriculum. Do not copy or
-- change release schedules, email-list membership, or any existing enrollment.
-- Checkout additionally verifies that every recording has been released and is available.
INSERT INTO course_batches
  (course_slug, batch_key, batch_label, status, is_active, paystack_reference_prefix,
   paystack_amount_minor, paypal_amount_minor, brevo_list_id, seat_limit,
   batch_start_at, batch_end_at, activated_at, created_at, updated_at)
SELECT source.course_slug, seed.offer_key, seed.offer_label, 'open', 0, seed.reference_prefix,
  COALESCE(NULLIF(course.price_ngn_minor, 0), source.paystack_amount_minor),
  COALESCE(NULLIF(course.price_usd_minor, 0), source.paypal_amount_minor), NULL, NULL,
  source.batch_start_at, source.batch_end_at, NULL, NOW(), NOW()
FROM (
  SELECT 'prompt-to-profit' AS course_slug, 'ptp-batch-4' AS source_key,
    'ptp-batch-4-self-paced' AS offer_key, 'Instant access · September 2026 recordings' AS offer_label, 'PTPSELF' AS reference_prefix
  UNION ALL SELECT 'prompt-to-production', 'ptpprod-batch-2',
    'ptpprod-batch-2-self-paced', 'Instant access · October 2026 recordings', 'PTPRODSELF'
) seed
JOIN course_batches source ON source.course_slug = seed.course_slug AND source.batch_key = seed.source_key
JOIN tochukwu_learning_courses course ON course.course_slug = source.course_slug
WHERE source.batch_start_at < DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
  AND NOT EXISTS (
    SELECT 1 FROM course_batches existing
    WHERE existing.course_slug = seed.course_slug AND existing.batch_key = seed.offer_key
  );
