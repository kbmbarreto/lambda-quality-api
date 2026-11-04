-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `email` VARCHAR(254) COLLATE utf8mb4_0900_bin NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `email_verified_at` DATETIME(3) NOT NULL,
    `password_changed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `revoke_reason` VARCHAR(50) NULL,

    INDEX `auth_sessions_user_id_revoked_at_expires_at_idx`(`user_id`, `revoked_at`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `session_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by_token_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_session_id_expires_at_idx`(`session_id`, `expires_at`),
    UNIQUE INDEX `refresh_tokens_session_id_id_key`(`session_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `email_challenges` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `email` VARCHAR(254) COLLATE utf8mb4_0900_bin NOT NULL,
    `purpose` ENUM('REGISTRATION', 'PASSWORD_RESET') NOT NULL,
    `code_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `eligible` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,

    INDEX `email_challenges_email_purpose_created_at_idx`(`email`, `purpose`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `email_code_scopes` (
    `id` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `last_requested_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `audit_events` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `actor_user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `correlation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    INDEX `audit_events_workspace_id_occurred_at_idx`(`workspace_id`, `occurred_at`),
    INDEX `audit_events_actor_user_id_occurred_at_idx`(`actor_user_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `auth_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_session_id_replaced_by_token_id_fkey` FOREIGN KEY (`session_id`, `replaced_by_token_id`) REFERENCES `refresh_tokens`(`session_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Limite mínimo de integridade; o máximo de tentativas é configurável na aplicação.
ALTER TABLE `email_challenges` ADD CONSTRAINT `email_challenges_attempts_nonnegative` CHECK (`attempts` >= 0);
