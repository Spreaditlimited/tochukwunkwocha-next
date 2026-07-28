ALTER TABLE course_orders
  ADD COLUMN course_amount_minor INT NULL AFTER base_amount_minor,
  ADD COLUMN vat_amount_minor INT NULL AFTER course_amount_minor,
  ADD COLUMN vat_percent DECIMAL(8,3) NULL AFTER vat_amount_minor,
  ADD COLUMN processing_fee_minor INT NULL AFTER vat_percent;

ALTER TABLE course_manual_payments
  ADD COLUMN course_amount_minor INT NULL AFTER base_amount_minor,
  ADD COLUMN vat_amount_minor INT NULL AFTER course_amount_minor,
  ADD COLUMN vat_percent DECIMAL(8,3) NULL AFTER vat_amount_minor,
  ADD COLUMN processing_fee_minor INT NULL AFTER vat_percent;

CREATE TABLE IF NOT EXISTS tochukwu_financial_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  transaction_uuid VARCHAR(100) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_uuid VARCHAR(100) NOT NULL,
  source_parent_uuid VARCHAR(100) NULL,
  category VARCHAR(30) NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  product_slug VARCHAR(190) NULL,
  product_label VARCHAR(255) NOT NULL,
  customer_name VARCHAR(190) NULL,
  customer_email VARCHAR(220) NULL,
  currency VARCHAR(12) NOT NULL,
  sales_amount_minor BIGINT NOT NULL DEFAULT 0,
  discount_minor BIGINT NOT NULL DEFAULT 0,
  vat_minor BIGINT NOT NULL DEFAULT 0,
  processing_fee_minor BIGINT NOT NULL DEFAULT 0,
  shipping_minor BIGINT NOT NULL DEFAULT 0,
  total_collected_minor BIGINT NOT NULL DEFAULT 0,
  provider VARCHAR(40) NULL,
  payment_reference VARCHAR(190) NULL,
  paid_at DATETIME NOT NULL,
  source_created_at DATETIME NULL,
  breakdown_quality VARCHAR(20) NOT NULL DEFAULT 'exact',
  metadata_json LONGTEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tochukwu_financial_transaction_uuid (transaction_uuid),
  UNIQUE KEY uniq_tochukwu_financial_source (source_type, source_uuid),
  KEY idx_tochukwu_financial_paid_at (paid_at),
  KEY idx_tochukwu_financial_category_paid (category, paid_at),
  KEY idx_tochukwu_financial_currency_paid (currency, paid_at),
  KEY idx_tochukwu_financial_product_paid (product_slug, paid_at),
  KEY idx_tochukwu_financial_provider_paid (provider, paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tochukwu_financial_export_audit (
  id BIGINT NOT NULL AUTO_INCREMENT,
  export_uuid VARCHAR(100) NOT NULL,
  admin_uuid VARCHAR(64) NOT NULL,
  format VARCHAR(12) NOT NULL,
  filters_json LONGTEXT NULL,
  row_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tochukwu_financial_export_uuid (export_uuid),
  KEY idx_tochukwu_financial_export_admin (admin_uuid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
