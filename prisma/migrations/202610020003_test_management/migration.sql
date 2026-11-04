-- CreateTable
CREATE TABLE `test_suites` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `parent_suite_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `archived_at` DATETIME(3) NULL,

    INDEX `test_suites_tree_idx`(`workspace_id`, `project_id`, `parent_suite_id`, `archived_at`, `position`),
    UNIQUE INDEX `test_suites_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `test_cases` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `suite_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `sequence` INTEGER NOT NULL,
    `title` VARCHAR(250) NOT NULL,
    `description` TEXT NULL,
    `preconditions` TEXT NULL,
    `postconditions` TEXT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `priority` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `layer` VARCHAR(20) NOT NULL,
    `behavior` VARCHAR(100) NULL,
    `automation_status` VARCHAR(30) NOT NULL,
    `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `version` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `archived_at` DATETIME(3) NULL,

    INDEX `test_cases_workspace_id_project_id_status_idx`(`workspace_id`, `project_id`, `status`),
    INDEX `test_cases_workspace_id_project_id_suite_id_idx`(`workspace_id`, `project_id`, `suite_id`),
    UNIQUE INDEX `test_cases_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    UNIQUE INDEX `test_cases_workspace_id_project_id_sequence_key`(`workspace_id`, `project_id`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `test_steps` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `position` INTEGER NOT NULL,
    `action` TEXT NOT NULL,
    `test_data` TEXT NULL,
    `expected_result` TEXT NULL,

    UNIQUE INDEX `test_steps_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    UNIQUE INDEX `test_steps_workspace_id_test_case_id_position_key`(`workspace_id`, `test_case_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `test_case_tags` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `tag_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    UNIQUE INDEX `test_case_tags_link_key`(`workspace_id`, `project_id`, `test_case_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `test_case_attachments` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `attachment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    UNIQUE INDEX `test_case_attachments_link_key`(`workspace_id`, `project_id`, `test_case_id`, `attachment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `test_case_field_values` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `field_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `value` JSON NOT NULL,

    UNIQUE INDEX `test_case_field_values_link_key`(`workspace_id`, `project_id`, `test_case_id`, `field_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `sequence_counters` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `entity_type` VARCHAR(30) NOT NULL,
    `next_value` INTEGER NOT NULL,

    UNIQUE INDEX `sequence_counters_scope_key`(`workspace_id`, `project_id`, `entity_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `test_suites` ADD CONSTRAINT `test_suites_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_suites` ADD CONSTRAINT `test_suites_workspace_id_project_id_parent_suite_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `parent_suite_id`) REFERENCES `test_suites`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_workspace_id_project_id_suite_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `suite_id`) REFERENCES `test_suites`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_steps` ADD CONSTRAINT `test_steps_workspace_id_project_id_test_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_case_id`) REFERENCES `test_cases`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_case_tags` ADD CONSTRAINT `test_case_tags_workspace_id_project_id_test_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_case_id`) REFERENCES `test_cases`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_case_tags` ADD CONSTRAINT `test_case_tags_workspace_id_tag_id_fkey` FOREIGN KEY (`workspace_id`, `tag_id`) REFERENCES `tags`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_case_attachments` ADD CONSTRAINT `test_case_attachments_workspace_id_project_id_test_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_case_id`) REFERENCES `test_cases`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_case_attachments` ADD CONSTRAINT `test_case_attachments_workspace_id_attachment_id_fkey` FOREIGN KEY (`workspace_id`, `attachment_id`) REFERENCES `attachments`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_case_field_values` ADD CONSTRAINT `test_case_field_values_workspace_id_project_id_test_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_case_id`) REFERENCES `test_cases`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_case_field_values` ADD CONSTRAINT `test_case_field_values_workspace_id_field_id_fkey` FOREIGN KEY (`workspace_id`, `field_id`) REFERENCES `custom_field_definitions`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sequence_counters` ADD CONSTRAINT `sequence_counters_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE `test_suites` ADD CONSTRAINT `test_suites_check_0` CHECK (position >= 1);

ALTER TABLE `test_suites` ADD CONSTRAINT `test_suites_check_1` CHECK (parent_suite_id IS NULL OR parent_suite_id <> id);

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_0` CHECK (sequence >= 1 AND version >= 1);

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_1` CHECK (severity IN ('TRIVIAL','MINOR','NORMAL','MAJOR','CRITICAL','BLOCKER'));

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_2` CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT'));

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_3` CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED','ARCHIVED'));

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_4` CHECK ((status = 'ARCHIVED' AND archived_at IS NOT NULL) OR (status <> 'ARCHIVED' AND archived_at IS NULL));

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_5` CHECK (type IN ('FUNCTIONAL','REGRESSION','SMOKE','SANITY','PERFORMANCE','SECURITY','USABILITY','OTHER'));

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_6` CHECK (layer IN ('E2E','API','INTEGRATION','UNIT','COMPONENT','OTHER'));

ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_check_7` CHECK (automation_status IN ('MANUAL','TO_BE_AUTOMATED','IN_PROGRESS','AUTOMATED','NOT_APPLICABLE'));

ALTER TABLE `test_steps` ADD CONSTRAINT `test_steps_check_0` CHECK (position >= 1);

ALTER TABLE `sequence_counters` ADD CONSTRAINT `sequence_counters_check_0` CHECK (next_value >= 1);

ALTER TABLE `sequence_counters` ADD CONSTRAINT `sequence_counters_check_1` CHECK (entity_type = 'TEST_CASE');

ALTER TABLE `test_case_field_values` ADD CONSTRAINT `test_case_field_values_check_0` CHECK (JSON_TYPE(value) IN ('STRING','INTEGER','DOUBLE','BOOLEAN'));
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000021', 'testcase.read', 'testcase.read');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000022', 'testcase.create', 'testcase.create');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000023', 'testcase.update', 'testcase.update');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000024', 'testcase.archive', 'testcase.archive');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),r.workspace_id,r.id,p.code FROM roles r CROSS JOIN permissions p
WHERE r.system_role = 1 AND r.normalized_name = 'administrator' AND p.code LIKE 'testcase.%';
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),workspace_id,id,'testcase.read' FROM roles WHERE system_role = 1 AND normalized_name = 'member';
