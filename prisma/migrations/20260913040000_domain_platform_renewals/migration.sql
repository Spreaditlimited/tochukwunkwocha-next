CREATE TABLE `domain_platform_renewals` (
 `id` VARCHAR(80) NOT NULL PRIMARY KEY,
 `partnerId` VARCHAR(191) NOT NULL,
 `domainOrderId` VARCHAR(80) NOT NULL,
 `hostname` VARCHAR(191) NOT NULL,
 `registrarOrderId` VARCHAR(191) NOT NULL,
 `expectedExpiry` DATETIME(3) NOT NULL,
 `confirmedExpiry` DATETIME(3) NULL,
 `years` INTEGER NOT NULL,
 `amountMinor` BIGINT NOT NULL,
 `quoteExpiresAt` DATETIME(3) NOT NULL,
 `status` VARCHAR(40) NOT NULL DEFAULT 'QUOTED',
 `paymentReference` VARCHAR(100) NULL UNIQUE,
 `checkoutUrl` TEXT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY `domain_renewal_expiry` (`domainOrderId`,`expectedExpiry`),
 KEY `domain_renewal_partner` (`partnerId`,`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
