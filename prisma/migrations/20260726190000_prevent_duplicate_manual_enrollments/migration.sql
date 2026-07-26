ALTER TABLE course_manual_payments
  ADD COLUMN approved_student_enrollment_key CHAR(64)
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'approved'
          AND COALESCE(buyer_type, 'student') <> 'family'
          AND NULLIF(TRIM(email), '') IS NOT NULL
          AND NULLIF(TRIM(course_slug), '') IS NOT NULL
        THEN SHA2(
          CONCAT(
            LOWER(TRIM(email)),
            '|',
            LOWER(TRIM(course_slug))
          ),
          256
        )
        ELSE NULL
      END
    ) VIRTUAL,
  ADD UNIQUE KEY uniq_manual_approved_student_course (approved_student_enrollment_key);
