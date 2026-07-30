CREATE TABLE IF NOT EXISTS `tochukwu_learning_lesson_progress` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT NOT NULL,
  `lesson_id` BIGINT NOT NULL,
  `module_id` BIGINT NOT NULL,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `completed_at` DATETIME NULL,
  `last_watched_at` DATETIME NULL,
  `watch_seconds` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_learning_lesson_progress` (`account_id`, `lesson_id`),
  KEY `idx_tochukwu_learning_progress_account` (`account_id`, `updated_at`),
  KEY `idx_tochukwu_learning_progress_lesson` (`lesson_id`),
  KEY `idx_tochukwu_learning_progress_module` (`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_learning_course_features` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `course_slug` VARCHAR(120) NOT NULL,
  `assignments_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `course_community_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `tutor_questions_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `alumni_participation_mode` VARCHAR(24) NOT NULL DEFAULT 'none',
  `certificate_proof_required` TINYINT(1) NOT NULL DEFAULT 0,
  `certificate_proof_type` VARCHAR(24) NOT NULL DEFAULT 'website_link',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_learning_course_feature_slug` (`course_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_learning_assignments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `assignment_uuid` VARCHAR(64) NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `account_id` BIGINT NOT NULL,
  `student_email` VARCHAR(220) NOT NULL,
  `student_name` VARCHAR(180) NULL,
  `lesson_id` BIGINT NULL,
  `module_id` BIGINT NULL,
  `submission_kind` VARCHAR(24) NOT NULL,
  `submission_text` TEXT NULL,
  `submission_link` VARCHAR(1500) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'submitted',
  `admin_feedback` TEXT NULL,
  `reviewed_by` VARCHAR(120) NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_learning_assignment_uuid` (`assignment_uuid`),
  KEY `idx_learning_assignment_course_status` (`course_slug`, `status`, `created_at`),
  KEY `idx_learning_assignment_student` (`student_email`, `course_slug`, `created_at`),
  KEY `idx_learning_assignment_account` (`account_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_learning_assignment_attachments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `assignment_id` BIGINT NOT NULL,
  `attachment_kind` VARCHAR(24) NOT NULL DEFAULT 'file',
  `attachment_url` VARCHAR(1500) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_learning_assignment_attachment_assignment` (`assignment_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_learning_assignment_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `assignment_id` BIGINT NOT NULL,
  `actor_type` VARCHAR(24) NOT NULL DEFAULT 'system',
  `actor_ref` VARCHAR(220) NULL,
  `event_type` VARCHAR(32) NOT NULL,
  `event_note` VARCHAR(800) NULL,
  `metadata_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_learning_assignment_event_assignment` (`assignment_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_learning_community_threads` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `thread_uuid` VARCHAR(64) NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `account_id` BIGINT NOT NULL,
  `author_email` VARCHAR(220) NOT NULL,
  `author_name` VARCHAR(180) NULL,
  `lesson_id` BIGINT NULL,
  `module_id` BIGINT NULL,
  `question_type` VARCHAR(24) NOT NULL DEFAULT 'peer',
  `title` VARCHAR(220) NOT NULL,
  `body` TEXT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'open',
  `replies_count` INT NOT NULL DEFAULT 0,
  `last_activity_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_learning_community_thread_uuid` (`thread_uuid`),
  KEY `idx_learning_community_course` (`course_slug`, `status`, `last_activity_at`),
  KEY `idx_learning_community_author` (`author_email`, `course_slug`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_learning_community_replies` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `reply_uuid` VARCHAR(64) NOT NULL,
  `thread_id` BIGINT NOT NULL,
  `parent_reply_id` BIGINT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `account_id` BIGINT NOT NULL,
  `author_email` VARCHAR(220) NOT NULL,
  `author_name` VARCHAR(180) NULL,
  `mention_account_id` BIGINT NULL,
  `mention_email` VARCHAR(220) NULL,
  `mention_name` VARCHAR(180) NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_learning_community_reply_uuid` (`reply_uuid`),
  KEY `idx_learning_community_reply_thread` (`thread_id`, `created_at`),
  KEY `idx_learning_community_reply_author` (`author_email`, `course_slug`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_transcript_access` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `request_reason` TEXT NULL,
  `requested_at` DATETIME NULL,
  `approved_at` DATETIME NULL,
  `approved_by` VARCHAR(64) NULL,
  `expires_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tochukwu_transcript_access_account_course` (`account_id`, `course_slug`),
  KEY `idx_tochukwu_transcript_access_status` (`status`, `updated_at`),
  KEY `idx_tochukwu_transcript_access_course` (`course_slug`, `status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tochukwu_transcript_access_audit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `lesson_id` BIGINT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `detail_json` LONGTEXT NULL,
  `ip_hash` VARCHAR(128) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tochukwu_transcript_audit_account` (`account_id`, `created_at`),
  KEY `idx_tochukwu_transcript_audit_course` (`course_slug`, `created_at`),
  KEY `idx_tochukwu_transcript_audit_event` (`event_type`, `status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @course_access_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_orders'
    AND INDEX_NAME = 'idx_course_orders_student_access'
);
SET @course_access_index_sql = IF(
  @course_access_index_exists = 0,
  'ALTER TABLE `course_orders` ADD INDEX `idx_course_orders_student_access` (`email`, `course_slug`, `status`, `buyer_type`, `created_at`)',
  'SELECT 1'
);
PREPARE course_access_index_statement FROM @course_access_index_sql;
EXECUTE course_access_index_statement;
DEALLOCATE PREPARE course_access_index_statement;

SET @manual_access_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_manual_payments'
    AND INDEX_NAME = 'idx_manual_payments_student_access'
);
SET @manual_access_index_sql = IF(
  @manual_access_index_exists = 0,
  'ALTER TABLE `course_manual_payments` ADD INDEX `idx_manual_payments_student_access` (`email`, `course_slug`, `status`, `buyer_type`, `created_at`)',
  'SELECT 1'
);
PREPARE manual_access_index_statement FROM @manual_access_index_sql;
EXECUTE manual_access_index_statement;
DEALLOCATE PREPARE manual_access_index_statement;

SET @family_child_account_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'family_children'
    AND INDEX_NAME = 'idx_family_child_account_status'
);
SET @family_child_account_index_sql = IF(
  @family_child_account_index_exists = 0,
  'ALTER TABLE `family_children` ADD INDEX `idx_family_child_account_status` (`account_id`, `status`)',
  'SELECT 1'
);
PREPARE family_child_account_index_statement FROM @family_child_account_index_sql;
EXECUTE family_child_account_index_statement;
DEALLOCATE PREPARE family_child_account_index_statement;
