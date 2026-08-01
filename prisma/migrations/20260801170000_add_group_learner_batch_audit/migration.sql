CREATE TABLE IF NOT EXISTS `tochukwu_group_learner_batch_changes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `family_id` BIGINT NOT NULL,
  `child_id` BIGINT NOT NULL,
  `parent_account_id` BIGINT NOT NULL,
  `course_slug` VARCHAR(120) NOT NULL,
  `old_batch_key` VARCHAR(64) NOT NULL,
  `old_batch_label` VARCHAR(120) NULL,
  `new_batch_key` VARCHAR(64) NOT NULL,
  `new_batch_label` VARCHAR(120) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tochukwu_group_batch_change_parent` (`parent_account_id`, `created_at`),
  KEY `idx_tochukwu_group_batch_change_child` (`child_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
