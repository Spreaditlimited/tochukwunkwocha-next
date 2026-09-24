CREATE TABLE `ask_questions` (
  `id` VARCHAR(36) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `body` TEXT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `facebook_url` VARCHAR(1000) NULL,
  `accepting_answers` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `published_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ask_question_status` (`status`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ask_answers` (
  `id` VARCHAR(36) NOT NULL,
  `question_id` VARCHAR(36) NOT NULL,
  `body` TEXT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ask_answer_question_status` (`question_id`, `status`, `created_at`),
  INDEX `idx_ask_answer_status` (`status`, `created_at`),
  CONSTRAINT `ask_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `ask_questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ask_rate_limits` (
  `key` VARCHAR(64) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 1,
  `expires_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`),
  INDEX `idx_ask_rate_expiry` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
