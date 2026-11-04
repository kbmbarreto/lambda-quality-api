-- CreateTable
CREATE TABLE `workspaces` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(80) COLLATE utf8mb4_nopad_bin NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `owner_member_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workspaces_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `workspace_members` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `joined_at` DATETIME(3) NOT NULL,

    INDEX `workspace_members_workspace_id_status_idx`(`workspace_id`, `status`),
    UNIQUE INDEX `workspace_members_workspace_id_id_key`(`workspace_id`, `id`),
    UNIQUE INDEX `workspace_members_workspace_id_user_id_key`(`workspace_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `description` VARCHAR(200) NOT NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `normalized_name` VARCHAR(100) COLLATE utf8mb4_nopad_bin NOT NULL,
    `description` VARCHAR(500) NULL,
    `system_role` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_workspace_id_id_key`(`workspace_id`, `id`),
    UNIQUE INDEX `roles_workspace_id_normalized_name_key`(`workspace_id`, `normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `normalized_name` VARCHAR(100) COLLATE utf8mb4_nopad_bin NOT NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `groups_workspace_id_id_key`(`workspace_id`, `id`),
    UNIQUE INDEX `groups_workspace_id_normalized_name_key`(`workspace_id`, `normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `role_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `permission_code` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `role_permissions_workspace_id_role_id_permission_code_key`(`workspace_id`, `role_id`, `permission_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `member_roles` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `member_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `role_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    INDEX `member_roles_workspace_id_role_id_idx`(`workspace_id`, `role_id`),
    UNIQUE INDEX `member_roles_workspace_id_member_id_role_id_key`(`workspace_id`, `member_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `group_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `member_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    INDEX `group_members_workspace_id_member_id_idx`(`workspace_id`, `member_id`),
    UNIQUE INDEX `group_members_workspace_id_group_id_member_id_key`(`workspace_id`, `group_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `group_roles` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `group_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `role_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    INDEX `group_roles_workspace_id_role_id_idx`(`workspace_id`, `role_id`),
    UNIQUE INDEX `group_roles_workspace_id_group_id_role_id_key`(`workspace_id`, `group_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `invitations` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `email` VARCHAR(254) COLLATE utf8mb4_nopad_bin NOT NULL,
    `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `expires_at` DATETIME(3) NOT NULL,
    `invited_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `accepted_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `accepted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `last_sent_at` DATETIME(3) NOT NULL,
    `delivery_status` VARCHAR(20) NOT NULL,
    `delivery_payload` TEXT NULL,
    `delivery_attempts` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `invitations_token_hash_key`(`token_hash`),
    INDEX `invitations_workspace_id_email_status_idx`(`workspace_id`, `email`, `status`),
    INDEX `invitations_delivery_status_last_sent_at_idx`(`delivery_status`, `last_sent_at`),
    UNIQUE INDEX `invitations_workspace_id_id_key`(`workspace_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `custom_field_definitions` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `key` VARCHAR(80) COLLATE utf8mb4_nopad_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `type` VARCHAR(30) NOT NULL,
    `target` VARCHAR(30) NOT NULL,
    `required` BOOLEAN NOT NULL,
    `position` INTEGER NOT NULL,
    `options` JSON NOT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `custom_field_definitions_workspace_id_archived_at_idx`(`workspace_id`, `archived_at`),
    UNIQUE INDEX `custom_field_definitions_workspace_id_id_key`(`workspace_id`, `id`),
    UNIQUE INDEX `custom_field_definitions_workspace_id_target_key_key`(`workspace_id`, `target`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `normalized_name` VARCHAR(100) COLLATE utf8mb4_nopad_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tags_workspace_id_id_key`(`workspace_id`, `id`),
    UNIQUE INDEX `tags_workspace_id_normalized_name_key`(`workspace_id`, `normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `storage_key` VARCHAR(100) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `content_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `uploaded_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `attachments_storage_key_key`(`storage_key`),
    INDEX `attachments_workspace_id_deleted_at_created_at_idx`(`workspace_id`, `deleted_at`, `created_at`),
    UNIQUE INDEX `attachments_workspace_id_id_key`(`workspace_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- AddForeignKey
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_id_owner_member_id_fkey` FOREIGN KEY (`id`, `owner_member_id`) REFERENCES `workspace_members`(`workspace_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_workspace_id_role_id_fkey` FOREIGN KEY (`workspace_id`, `role_id`) REFERENCES `roles`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_code_fkey` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `member_roles` ADD CONSTRAINT `member_roles_workspace_id_member_id_fkey` FOREIGN KEY (`workspace_id`, `member_id`) REFERENCES `workspace_members`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `member_roles` ADD CONSTRAINT `member_roles_workspace_id_role_id_fkey` FOREIGN KEY (`workspace_id`, `role_id`) REFERENCES `roles`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_workspace_id_group_id_fkey` FOREIGN KEY (`workspace_id`, `group_id`) REFERENCES `groups`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_workspace_id_member_id_fkey` FOREIGN KEY (`workspace_id`, `member_id`) REFERENCES `workspace_members`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `group_roles` ADD CONSTRAINT `group_roles_workspace_id_group_id_fkey` FOREIGN KEY (`workspace_id`, `group_id`) REFERENCES `groups`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `group_roles` ADD CONSTRAINT `group_roles_workspace_id_role_id_fkey` FOREIGN KEY (`workspace_id`, `role_id`) REFERENCES `roles`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `custom_field_definitions` ADD CONSTRAINT `custom_field_definitions_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `tags_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Global permission catalog for the Workspace phase.
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000001', 'workspace.read', 'workspace.read');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000002', 'workspace.update', 'workspace.update');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000003', 'workspace.manage_members', 'workspace.manage_members');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000004', 'workspace.manage_roles', 'workspace.manage_roles');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000005', 'workspace.manage_groups', 'workspace.manage_groups');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000006', 'field.read', 'field.read');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000007', 'field.manage', 'field.manage');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000008', 'tag.read', 'tag.read');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000009', 'tag.manage', 'tag.manage');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000010', 'attachment.read', 'attachment.read');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000011', 'attachment.upload', 'attachment.upload');
INSERT INTO permissions (id, code, description) VALUES ('00000000-0000-4000-8000-000000000012', 'attachment.delete', 'attachment.delete');
ALTER TABLE workspace_members ADD CONSTRAINT workspace_member_status_check CHECK (status IN ('ACTIVE','SUSPENDED','REMOVED'));
ALTER TABLE workspaces ADD CONSTRAINT workspace_status_check CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED'));
ALTER TABLE invitations ADD CONSTRAINT invitation_status_check CHECK (status IN ('PENDING','ACCEPTED','CANCELED')), ADD CONSTRAINT invitation_delivery_status_check CHECK (delivery_status IN ('PENDING','SENT','FAILED')), ADD CONSTRAINT invitation_attempts_check CHECK (delivery_attempts >= 0);
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_type_check CHECK (type IN ('TEXT','NUMBER','BOOLEAN','DATE','SINGLE_SELECT')), ADD CONSTRAINT custom_field_target_check CHECK (target = 'TEST_CASE'), ADD CONSTRAINT custom_field_position_check CHECK (position >= 0);
ALTER TABLE attachments ADD CONSTRAINT attachment_size_check CHECK (size_bytes > 0);
