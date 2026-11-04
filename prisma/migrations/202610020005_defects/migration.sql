-- CreateTable
CREATE TABLE `defects` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `sequence` INTEGER NOT NULL,
    `title` VARCHAR(250) NOT NULL,
    `description` TEXT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `test_run_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `external_system` VARCHAR(50) NULL,
    `external_issue_id` VARCHAR(250) NULL,
    `external_url` VARCHAR(2048) NULL,
    `version` INTEGER NOT NULL,
    `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `defects_workspace_id_project_id_status_idx`(`workspace_id`, `project_id`, `status`),
    INDEX `defects_workspace_id_project_id_test_run_case_id_idx`(`workspace_id`, `project_id`, `test_run_case_id`),
    UNIQUE INDEX `defects_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    UNIQUE INDEX `defects_workspace_id_project_id_sequence_key`(`workspace_id`, `project_id`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `defect_attachments` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `defect_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `attachment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    UNIQUE INDEX `defect_attachments_workspace_id_defect_id_attachment_id_key`(`workspace_id`, `defect_id`, `attachment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateIndex
CREATE UNIQUE INDEX `run_cases_defect_scope_key` ON `test_run_cases`(`workspace_id`, `project_id`, `id`);

-- AddForeignKey
ALTER TABLE `defects` ADD CONSTRAINT `defects_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `defects` ADD CONSTRAINT `defects_workspace_id_project_id_test_run_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_run_case_id`) REFERENCES `test_run_cases`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `defect_attachments` ADD CONSTRAINT `defect_attachments_workspace_id_project_id_defect_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `defect_id`) REFERENCES `defects`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `defect_attachments` ADD CONSTRAINT `defect_attachments_workspace_id_attachment_id_fkey` FOREIGN KEY (`workspace_id`, `attachment_id`) REFERENCES `attachments`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE defects ADD CONSTRAINT defects_version_check CHECK (version >= 1);
ALTER TABLE defects ADD CONSTRAINT defects_sequence_check CHECK (sequence >= 1);
ALTER TABLE defects ADD CONSTRAINT defects_status_check CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED','REJECTED'));
ALTER TABLE defects ADD CONSTRAINT defects_severity_check CHECK (severity IN ('TRIVIAL','MINOR','NORMAL','MAJOR','CRITICAL','BLOCKER'));
ALTER TABLE defects ADD CONSTRAINT defects_external_check CHECK ((external_system IS NULL AND external_issue_id IS NULL AND external_url IS NULL) OR (external_system IS NOT NULL AND external_issue_id IS NOT NULL AND external_url IS NOT NULL));
ALTER TABLE sequence_counters DROP CHECK sequence_counters_check_1;
ALTER TABLE sequence_counters ADD CONSTRAINT sequence_counters_check_1 CHECK (entity_type IN ('TEST_CASE','DEFECT'));
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000028','defect.read','defect.read'),('00000000-0000-4000-8000-000000000029','defect.manage','defect.manage');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),r.workspace_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system_role = 1 AND r.normalized_name = 'administrator' AND p.code IN ('defect.read','defect.manage');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),workspace_id,id,'defect.read' FROM roles WHERE system_role = 1 AND normalized_name = 'member';
