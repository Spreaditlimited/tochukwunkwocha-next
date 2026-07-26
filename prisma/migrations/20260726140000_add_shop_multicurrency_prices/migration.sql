CREATE TABLE `tochukwu_shop_variant_prices` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `price_uuid` VARCHAR(64) NOT NULL,
  `variant_id` BIGINT NOT NULL,
  `currency` VARCHAR(12) NOT NULL,
  `amount_minor` INTEGER NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_shop_price_uuid`(`price_uuid`),
  UNIQUE INDEX `uniq_tochukwu_shop_price_variant_currency`(`variant_id`, `currency`),
  INDEX `idx_tochukwu_shop_price_currency_active`(`currency`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tochukwu_shop_price_variant_fk`
    FOREIGN KEY (`variant_id`) REFERENCES `tochukwu_shop_product_variants`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
