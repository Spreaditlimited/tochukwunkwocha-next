CREATE TABLE `tochukwu_shop_products` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `product_uuid` VARCHAR(64) NOT NULL,
  `slug` VARCHAR(190) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(255) NULL,
  `short_description` TEXT NOT NULL,
  `body_content` LONGTEXT NULL,
  `cover_image_url` TEXT NULL,
  `gallery_json` LONGTEXT NULL,
  `category` VARCHAR(80) NOT NULL DEFAULT 'workbooks',
  `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
  `featured` BOOLEAN NOT NULL DEFAULT false,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` VARCHAR(500) NULL,
  `faq_json` LONGTEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `published_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_shop_product_uuid`(`product_uuid`),
  UNIQUE INDEX `uniq_tochukwu_shop_product_slug`(`slug`),
  INDEX `idx_tochukwu_shop_product_status_sort`(`status`, `sort_order`),
  INDEX `idx_tochukwu_shop_product_category_status`(`category`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tochukwu_shop_product_variants` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `variant_uuid` VARCHAR(64) NOT NULL,
  `product_id` BIGINT NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `fulfillment_type` VARCHAR(20) NOT NULL,
  `price_minor` INTEGER NOT NULL,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'NGN',
  `compare_at_minor` INTEGER NULL,
  `stock_quantity` INTEGER NULL,
  `inventory_policy` VARCHAR(20) NOT NULL DEFAULT 'deny',
  `digital_asset_key` TEXT NULL,
  `digital_filename` VARCHAR(255) NULL,
  `weight_grams` INTEGER NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_shop_variant_uuid`(`variant_uuid`),
  UNIQUE INDEX `uniq_tochukwu_shop_variant_sku`(`sku`),
  INDEX `idx_tochukwu_shop_variant_product_active`(`product_id`, `active`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tochukwu_shop_variant_product_fk`
    FOREIGN KEY (`product_id`) REFERENCES `tochukwu_shop_products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tochukwu_shop_orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_uuid` VARCHAR(64) NOT NULL,
  `order_number` VARCHAR(40) NOT NULL,
  `student_account_id` BIGINT NULL,
  `customer_name` VARCHAR(180) NOT NULL,
  `customer_email` VARCHAR(190) NOT NULL,
  `customer_phone` VARCHAR(40) NULL,
  `customer_country` VARCHAR(100) NULL,
  `currency` VARCHAR(12) NOT NULL,
  `subtotal_minor` INTEGER NOT NULL,
  `discount_minor` INTEGER NOT NULL DEFAULT 0,
  `shipping_minor` INTEGER NOT NULL DEFAULT 0,
  `tax_minor` INTEGER NOT NULL DEFAULT 0,
  `total_minor` INTEGER NOT NULL,
  `payment_provider` VARCHAR(30) NOT NULL,
  `provider_reference` VARCHAR(190) NULL,
  `provider_order_id` VARCHAR(190) NULL,
  `payment_status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `fulfillment_status` VARCHAR(30) NOT NULL DEFAULT 'unfulfilled',
  `shipping_address_json` LONGTEXT NULL,
  `paid_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_shop_order_uuid`(`order_uuid`),
  UNIQUE INDEX `uniq_tochukwu_shop_order_number`(`order_number`),
  UNIQUE INDEX `uniq_tochukwu_shop_provider_reference`(`provider_reference`),
  INDEX `idx_tochukwu_shop_order_email_created`(`customer_email`, `created_at`),
  INDEX `idx_tochukwu_shop_order_payment_created`(`payment_status`, `created_at`),
  INDEX `idx_tochukwu_shop_order_fulfillment_created`(`fulfillment_status`, `created_at`),
  INDEX `idx_tochukwu_shop_order_student_created`(`student_account_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tochukwu_shop_order_student_fk`
    FOREIGN KEY (`student_account_id`) REFERENCES `student_accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tochukwu_shop_order_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `item_uuid` VARCHAR(64) NOT NULL,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT NULL,
  `variant_id` BIGINT NULL,
  `product_title_snapshot` VARCHAR(255) NOT NULL,
  `product_slug_snapshot` VARCHAR(190) NOT NULL,
  `variant_title_snapshot` VARCHAR(160) NOT NULL,
  `sku_snapshot` VARCHAR(100) NOT NULL,
  `fulfillment_type_snapshot` VARCHAR(20) NOT NULL,
  `unit_price_minor` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `line_total_minor` INTEGER NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `uniq_tochukwu_shop_order_item_uuid`(`item_uuid`),
  INDEX `idx_tochukwu_shop_order_item_order`(`order_id`),
  INDEX `idx_tochukwu_shop_order_item_product`(`product_id`),
  INDEX `idx_tochukwu_shop_order_item_variant`(`variant_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tochukwu_shop_item_order_fk`
    FOREIGN KEY (`order_id`) REFERENCES `tochukwu_shop_orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tochukwu_shop_item_product_fk`
    FOREIGN KEY (`product_id`) REFERENCES `tochukwu_shop_products`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tochukwu_shop_item_variant_fk`
    FOREIGN KEY (`variant_id`) REFERENCES `tochukwu_shop_product_variants`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tochukwu_shop_digital_entitlements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `entitlement_uuid` VARCHAR(64) NOT NULL,
  `order_id` BIGINT NOT NULL,
  `order_item_id` BIGINT NOT NULL,
  `variant_id` BIGINT NULL,
  `recipient_email` VARCHAR(190) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `download_count` INTEGER NOT NULL DEFAULT 0,
  `last_download_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_shop_entitlement_uuid`(`entitlement_uuid`),
  UNIQUE INDEX `uniq_tochukwu_shop_entitlement_item_email`(`order_item_id`, `recipient_email`),
  INDEX `idx_tochukwu_shop_entitlement_email_status`(`recipient_email`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tochukwu_shop_entitlement_order_fk`
    FOREIGN KEY (`order_id`) REFERENCES `tochukwu_shop_orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tochukwu_shop_entitlement_item_fk`
    FOREIGN KEY (`order_item_id`) REFERENCES `tochukwu_shop_order_items`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tochukwu_shop_entitlement_variant_fk`
    FOREIGN KEY (`variant_id`) REFERENCES `tochukwu_shop_product_variants`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tochukwu_shop_shipments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `shipment_uuid` VARCHAR(64) NOT NULL,
  `order_id` BIGINT NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'processing',
  `carrier` VARCHAR(120) NULL,
  `service` VARCHAR(120) NULL,
  `tracking_number` VARCHAR(190) NULL,
  `tracking_url` TEXT NULL,
  `admin_notes` TEXT NULL,
  `shipped_at` DATETIME(0) NULL,
  `delivered_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL,
  UNIQUE INDEX `uniq_tochukwu_shop_shipment_uuid`(`shipment_uuid`),
  UNIQUE INDEX `uniq_tochukwu_shop_shipment_order`(`order_id`),
  INDEX `idx_tochukwu_shop_shipment_status_created`(`status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tochukwu_shop_shipment_order_fk`
    FOREIGN KEY (`order_id`) REFERENCES `tochukwu_shop_orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
