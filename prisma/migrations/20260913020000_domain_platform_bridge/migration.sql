CREATE TABLE `domain_platform_nonces` (
 `nonce` VARCHAR(80) NOT NULL PRIMARY KEY,
 `expiresAt` DATETIME(3) NOT NULL,
 INDEX `domain_platform_nonce_expiry` (`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `domain_platform_orders` (
 `id` VARCHAR(80) NOT NULL PRIMARY KEY,
 `partnerId` VARCHAR(191) NOT NULL,
 `hostname` VARCHAR(191) NOT NULL UNIQUE,
 `years` INTEGER NOT NULL,
 `amountMinor` BIGINT NOT NULL,
 `quoteExpiresAt` DATETIME(3) NOT NULL,
 `status` VARCHAR(40) NOT NULL DEFAULT 'QUOTED',
 `paymentReference` VARCHAR(100) NULL UNIQUE,
 `checkoutUrl` TEXT NULL,
 `registrantCiphertext` TEXT NULL,
 `registrarOrderId` VARCHAR(191) NULL,
 `expiresAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX `domain_platform_partner` (`partnerId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
