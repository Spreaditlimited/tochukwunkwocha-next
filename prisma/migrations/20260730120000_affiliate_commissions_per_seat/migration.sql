SET @affiliate_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
);

SET @seat_number_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
    AND COLUMN_NAME = 'seat_number'
);
SET @seat_number_sql = IF(
  @affiliate_table_exists = 1 AND @seat_number_exists = 0,
  'ALTER TABLE `tochukwu_affiliate_commissions` ADD COLUMN `seat_number` INTEGER NOT NULL DEFAULT 1 AFTER `order_uuid`',
  'SELECT 1'
);
PREPARE affiliate_seat_number_statement FROM @seat_number_sql;
EXECUTE affiliate_seat_number_statement;
DEALLOCATE PREPARE affiliate_seat_number_statement;

SET @seat_count_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
    AND COLUMN_NAME = 'seat_count'
);
SET @seat_count_sql = IF(
  @affiliate_table_exists = 1 AND @seat_count_exists = 0,
  'ALTER TABLE `tochukwu_affiliate_commissions` ADD COLUMN `seat_count` INTEGER NOT NULL DEFAULT 1 AFTER `seat_number`',
  'SELECT 1'
);
PREPARE affiliate_seat_count_statement FROM @seat_count_sql;
EXECUTE affiliate_seat_count_statement;
DEALLOCATE PREPARE affiliate_seat_count_statement;

SET @old_order_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
    AND INDEX_NAME = 'uniq_tochukwu_aff_commission_order'
);
SET @drop_old_order_index_sql = IF(
  @affiliate_table_exists = 1 AND @old_order_index_exists > 0,
  'ALTER TABLE `tochukwu_affiliate_commissions` DROP INDEX `uniq_tochukwu_aff_commission_order`',
  'SELECT 1'
);
PREPARE affiliate_drop_order_index_statement FROM @drop_old_order_index_sql;
EXECUTE affiliate_drop_order_index_statement;
DEALLOCATE PREPARE affiliate_drop_order_index_statement;

SET @seat_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tochukwu_affiliate_commissions'
    AND INDEX_NAME = 'uniq_tochukwu_aff_commission_order_seat'
);
SET @add_seat_index_sql = IF(
  @affiliate_table_exists = 1 AND @seat_index_exists = 0,
  'ALTER TABLE `tochukwu_affiliate_commissions` ADD UNIQUE INDEX `uniq_tochukwu_aff_commission_order_seat` (`order_uuid`, `seat_number`)',
  'SELECT 1'
);
PREPARE affiliate_add_seat_index_statement FROM @add_seat_index_sql;
EXECUTE affiliate_add_seat_index_statement;
DEALLOCATE PREPARE affiliate_add_seat_index_statement;
