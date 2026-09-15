ALTER TABLE domain_platform_orders
 ADD COLUMN country CHAR(2) NOT NULL DEFAULT 'NG',
 ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'NGN',
 ADD COLUMN paymentProvider VARCHAR(20) NOT NULL DEFAULT 'paystack',
 ADD COLUMN pricingJson JSON NULL;
ALTER TABLE domain_platform_renewals
 ADD COLUMN country CHAR(2) NOT NULL DEFAULT 'NG',
 ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'NGN',
 ADD COLUMN paymentProvider VARCHAR(20) NOT NULL DEFAULT 'paystack',
 ADD COLUMN pricingJson JSON NULL;

