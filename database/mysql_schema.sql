-- MasrafPro MySQL 8 / MariaDB Schema
-- UTF-8 (utf8mb4) ile veritabani olusturup bu dosyayi dogrudan ice aktarabilirsiniz:
--   mysql -u root -p masrafpro < database/mysql_schema.sql

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(191) NOT NULL UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'calisan',
  `department` VARCHAR(191) NOT NULL DEFAULT 'Genel',
  `phone` VARCHAR(64) NOT NULL DEFAULT '',
  `iban` VARCHAR(64) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(255) NULL,
  `monthly_budget_limit` DOUBLE NOT NULL DEFAULT 15000,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_settings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `company_name` VARCHAR(255) NOT NULL DEFAULT 'Anadolu Kurumsal A.Ş.',
  `short_name` VARCHAR(32) NOT NULL DEFAULT 'MasrafPro',
  `tax_number` VARCHAR(64) NOT NULL DEFAULT '',
  `tax_office` VARCHAR(191) NOT NULL DEFAULT '',
  `logo_data_url` LONGTEXT NULL,
  `pwa_icon_data_url` LONGTEXT NULL,
  `monthly_company_budget` DOUBLE NOT NULL DEFAULT 120000,
  `require_receipt_above_amount` DOUBLE NOT NULL DEFAULT 500,
  `setup_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `merchant` VARCHAR(255) NOT NULL,
  `merchant_tax_id` VARCHAR(64) NOT NULL DEFAULT '',
  `receipt_number` VARCHAR(128) NOT NULL DEFAULT '',
  `document_type` VARCHAR(64) NOT NULL DEFAULT 'fis',
  `category` VARCHAR(191) NOT NULL,
  `account_code` VARCHAR(32) NOT NULL DEFAULT '770',
  `cost_center` VARCHAR(191) NOT NULL DEFAULT 'Merkez',
  `payment_method` VARCHAR(64) NOT NULL DEFAULT 'kisisel_kart',
  `amount` DOUBLE NOT NULL,
  `vat_rate` INT NOT NULL DEFAULT 0,
  `vat_amount` DOUBLE NOT NULL DEFAULT 0,
  `net_amount` DOUBLE NOT NULL DEFAULT 0,
  `currency` VARCHAR(16) NOT NULL DEFAULT 'TRY',
  `expense_date` VARCHAR(32) NOT NULL,
  `description` TEXT NOT NULL,
  `receipt_image_data_url` LONGTEXT NULL,
  `voice_note_data_url` LONGTEXT NULL,
  `voice_transcript` TEXT NOT NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `location_accuracy` DOUBLE NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'onaylandi',
  `rejection_reason` VARCHAR(500) NOT NULL DEFAULT '',
  `reviewed_by_user_id` INT NULL,
  `reviewed_at` TIMESTAMP NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deleted_at` TIMESTAMP NULL,
  `deleted_by_user_id` INT NULL,
  `delete_reason` VARCHAR(500) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_expenses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `expense_id` INT NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `actor_user_id` INT NOT NULL,
  `actor_name` VARCHAR(255) NOT NULL,
  `actor_role` VARCHAR(32) NOT NULL,
  `owner_user_id` INT NOT NULL,
  `owner_name` VARCHAR(255) NOT NULL,
  `merchant` VARCHAR(255) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `expense_date` VARCHAR(32) NOT NULL,
  `reason` TEXT NOT NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `snapshot_json` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payouts` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `amount` DOUBLE NOT NULL,
  `payout_date` VARCHAR(32) NOT NULL,
  `payment_channel` VARCHAR(64) NOT NULL DEFAULT 'havale_eft',
  `reference_no` VARCHAR(191) NOT NULL DEFAULT '',
  `description` TEXT NOT NULL,
  `created_by_admin_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payouts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_payouts_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
