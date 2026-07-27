CREATE TABLE `tochukwu_site_showcases` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `showcase_uuid` VARCHAR(80) NOT NULL,
  `placement_key` VARCHAR(80) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `site_url` TEXT NOT NULL,
  `display_url` VARCHAR(500) NOT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(0) NOT NULL,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_site_showcase_uuid`(`showcase_uuid`),
  INDEX `idx_tochukwu_site_showcase_placement`(`placement_key`, `is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tochukwu_site_showcases`
  (`showcase_uuid`, `placement_key`, `title`, `site_url`, `display_url`, `sort_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('ptp-showcase-01', 'prompt-to-profit', 'Student website 1', 'https://splendorous-marzipan-6befc0.netlify.app/', 'splendorous-marzipan-6befc0.netlify.app', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ptp-showcase-02', 'prompt-to-profit', 'Student website 2', 'https://olytribe.com.ng/', 'olytribe.com.ng', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ptp-showcase-03', 'prompt-to-profit', 'Student website 3', 'https://themancavenaija.com/', 'themancavenaija.com', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ptp-showcase-04', 'prompt-to-profit', 'Student website 4', 'https://treshatrendy.vercel.app/', 'treshatrendy.vercel.app', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ptp-schools-showcase-01', 'prompt-to-profit-schools', 'The Man Cave Naija', 'https://themancavenaija.com/', 'themancavenaija.com', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ptp-schools-showcase-02', 'prompt-to-profit-schools', 'Kachi Game Arcade', 'https://kachigamearcade.netlify.app/', 'kachigamearcade.netlify.app', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
