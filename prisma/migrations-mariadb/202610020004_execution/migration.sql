-- CreateTable
CREATE TABLE `test_plans` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `milestone_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `environment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL,
    `version` INTEGER NOT NULL,
    `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `activated_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `archived_at` DATETIME(3) NULL,

    INDEX `test_plans_workspace_id_project_id_status_idx`(`workspace_id`, `project_id`, `status`),
    UNIQUE INDEX `test_plans_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `test_plan_cases` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_plan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `position` INTEGER NOT NULL,

    UNIQUE INDEX `test_plan_cases_workspace_id_test_plan_id_test_case_id_key`(`workspace_id`, `test_plan_id`, `test_case_id`),
    UNIQUE INDEX `test_plan_cases_workspace_id_test_plan_id_position_key`(`workspace_id`, `test_plan_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `test_runs` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_plan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `milestone_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `environment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `plan_name_snapshot` VARCHAR(100) NULL,
    `milestone_snapshot` JSON NULL,
    `environment_snapshot` JSON NULL,
    `name` VARCHAR(100) NOT NULL,
    `source` VARCHAR(30) NOT NULL,
    `external_run_ref` VARCHAR(250) NULL,
    `status` VARCHAR(20) NOT NULL,
    `version` INTEGER NOT NULL,
    `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,

    INDEX `test_runs_workspace_id_project_id_status_idx`(`workspace_id`, `project_id`, `status`),
    INDEX `test_runs_workspace_id_project_id_test_plan_id_idx`(`workspace_id`, `project_id`, `test_plan_id`),
    UNIQUE INDEX `test_runs_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `test_run_cases` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_run_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `position` INTEGER NOT NULL,
    `case_sequence_snapshot` INTEGER NOT NULL,
    `human_id_snapshot` VARCHAR(30) NOT NULL,
    `title_snapshot` VARCHAR(250) NOT NULL,
    `severity_snapshot` VARCHAR(20) NOT NULL,
    `priority_snapshot` VARCHAR(20) NOT NULL,
    `definition_snapshot` JSON NOT NULL,
    `custom_fields_snapshot` JSON NOT NULL,
    `tags_snapshot` JSON NOT NULL,
    `result` VARCHAR(20) NOT NULL,
    `executed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `executed_at` DATETIME(3) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `test_run_cases_workspace_id_test_run_id_result_idx`(`workspace_id`, `test_run_id`, `result`),
    UNIQUE INDEX `run_cases_scope_key`(`workspace_id`, `project_id`, `test_run_id`, `id`),
    UNIQUE INDEX `test_run_cases_workspace_id_test_run_id_test_case_id_key`(`workspace_id`, `test_run_id`, `test_case_id`),
    UNIQUE INDEX `test_run_cases_workspace_id_test_run_id_position_key`(`workspace_id`, `test_run_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `test_run_steps` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_run_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_run_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `source_step_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `position` INTEGER NOT NULL,
    `action_snapshot` TEXT NOT NULL,
    `test_data_snapshot` TEXT NULL,
    `expected_result_snapshot` TEXT NULL,
    `actual_result` TEXT NULL,
    `result` VARCHAR(20) NOT NULL,
    `comment` TEXT NULL,
    `executed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `executed_at` DATETIME(3) NULL,

    UNIQUE INDEX `run_steps_scope_key`(`workspace_id`, `project_id`, `test_run_id`, `test_run_case_id`, `id`),
    UNIQUE INDEX `test_run_steps_workspace_id_test_run_case_id_position_key`(`workspace_id`, `test_run_case_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- CreateTable
CREATE TABLE `execution_comments` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `test_run_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `run_case_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `run_step_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `text` TEXT NOT NULL,
    `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `execution_comments_list_idx`(`workspace_id`, `project_id`, `test_run_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

-- AddForeignKey
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_workspace_id_project_id_milestone_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `milestone_id`) REFERENCES `milestones`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_workspace_id_project_id_environment_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `environment_id`) REFERENCES `environments`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_plan_cases` ADD CONSTRAINT `test_plan_cases_workspace_id_project_id_test_plan_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_plan_id`) REFERENCES `test_plans`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_plan_cases` ADD CONSTRAINT `test_plan_cases_workspace_id_project_id_test_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_case_id`) REFERENCES `test_cases`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_workspace_id_project_id_test_plan_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_plan_id`) REFERENCES `test_plans`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_workspace_id_project_id_milestone_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `milestone_id`) REFERENCES `milestones`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_workspace_id_project_id_environment_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `environment_id`) REFERENCES `environments`(`workspace_id`, `project_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_run_cases` ADD CONSTRAINT `test_run_cases_workspace_id_project_id_test_run_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_run_id`) REFERENCES `test_runs`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_run_cases` ADD CONSTRAINT `test_run_cases_workspace_id_project_id_test_case_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_case_id`) REFERENCES `test_cases`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `test_run_steps` ADD CONSTRAINT `test_run_steps_workspace_id_project_id_test_run_id_test_run_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_run_id`, `test_run_case_id`) REFERENCES `test_run_cases`(`workspace_id`, `project_id`, `test_run_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `execution_comments` ADD CONSTRAINT `execution_comments_workspace_id_project_id_test_run_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`, `test_run_id`) REFERENCES `test_runs`(`workspace_id`, `project_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `execution_comments` ADD CONSTRAINT `execution_comments_case_fk` FOREIGN KEY (`workspace_id`, `project_id`, `test_run_id`, `run_case_id`) REFERENCES `test_run_cases`(`workspace_id`, `project_id`, `test_run_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `execution_comments` ADD CONSTRAINT `execution_comments_step_fk` FOREIGN KEY (`workspace_id`, `project_id`, `test_run_id`, `run_case_id`, `run_step_id`) REFERENCES `test_run_steps`(`workspace_id`, `project_id`, `test_run_id`, `test_run_case_id`, `id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_check_0` CHECK (version >= 1);
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_check_1` CHECK (status IN ('DRAFT','ACTIVE','COMPLETED','ARCHIVED'));
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_check_2` CHECK ((status <> 'ARCHIVED' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL));
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_check_3` CHECK (status <> 'ACTIVE' OR activated_at IS NOT NULL);
ALTER TABLE `test_plans` ADD CONSTRAINT `test_plans_check_4` CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL);
ALTER TABLE `test_plan_cases` ADD CONSTRAINT `test_plan_cases_check_0` CHECK (position >= 1);
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_check_0` CHECK (version >= 1);
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_check_1` CHECK (source = 'MANUAL' AND external_run_ref IS NULL);
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_check_2` CHECK (status IN ('CREATED','IN_PROGRESS','COMPLETED','ABORTED'));
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_check_3` CHECK ((status IN ('COMPLETED','ABORTED') AND finished_at IS NOT NULL) OR (status IN ('CREATED','IN_PROGRESS') AND finished_at IS NULL));
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_check_4` CHECK (status NOT IN ('IN_PROGRESS','COMPLETED') OR started_at IS NOT NULL);
ALTER TABLE `test_run_cases` ADD CONSTRAINT `test_run_cases_check_0` CHECK (position >= 1 AND case_sequence_snapshot >= 1);
ALTER TABLE `test_run_cases` ADD CONSTRAINT `test_run_cases_check_1` CHECK (result IN ('NOT_TESTED','PASSED','FAILED','BLOCKED','SKIPPED'));
ALTER TABLE `test_run_cases` ADD CONSTRAINT `test_run_cases_check_2` CHECK ((result = 'NOT_TESTED' AND executed_by IS NULL AND executed_at IS NULL) OR (result <> 'NOT_TESTED' AND executed_by IS NOT NULL AND executed_at IS NOT NULL));
ALTER TABLE `test_run_cases` ADD CONSTRAINT `test_run_cases_check_3` CHECK (JSON_TYPE(definition_snapshot) = 'OBJECT' AND JSON_TYPE(custom_fields_snapshot) = 'ARRAY' AND JSON_TYPE(tags_snapshot) = 'ARRAY');
ALTER TABLE `test_run_steps` ADD CONSTRAINT `test_run_steps_check_0` CHECK (position >= 1);
ALTER TABLE `test_run_steps` ADD CONSTRAINT `test_run_steps_check_1` CHECK (result IN ('NOT_TESTED','PASSED','FAILED','BLOCKED','SKIPPED'));
ALTER TABLE `test_run_steps` ADD CONSTRAINT `test_run_steps_check_2` CHECK ((result = 'NOT_TESTED' AND executed_by IS NULL AND executed_at IS NULL) OR (result <> 'NOT_TESTED' AND executed_by IS NOT NULL AND executed_at IS NOT NULL));
ALTER TABLE `execution_comments` ADD CONSTRAINT `execution_comments_check_0` CHECK (run_step_id IS NULL OR run_case_id IS NOT NULL);
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000025','testrun.read','testrun.read');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000026','testrun.execute','testrun.execute');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000027','testrun.manage','testrun.manage');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),r.workspace_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system_role = 1 AND r.normalized_name = 'administrator' AND p.code LIKE 'testrun.%';
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),workspace_id,id,'testrun.read' FROM roles WHERE system_role = 1 AND normalized_name = 'member';
