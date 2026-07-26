ALTER TABLE `tochukwu_shop_product_variants`
  ADD COLUMN `cloudinary_public_id` TEXT NULL AFTER `digital_filename`,
  ADD COLUMN `cloudinary_resource_type` VARCHAR(20) NULL AFTER `cloudinary_public_id`,
  ADD COLUMN `cloudinary_delivery_type` VARCHAR(20) NULL AFTER `cloudinary_resource_type`,
  ADD COLUMN `cloudinary_format` VARCHAR(20) NULL AFTER `cloudinary_delivery_type`,
  ADD COLUMN `cloudinary_version` VARCHAR(40) NULL AFTER `cloudinary_format`,
  ADD COLUMN `cloudinary_bytes` INTEGER NULL AFTER `cloudinary_version`;
