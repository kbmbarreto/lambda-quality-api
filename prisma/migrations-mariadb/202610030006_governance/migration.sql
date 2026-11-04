-- Fase 06: tabelas incrementais, sem alterar históricos das fases anteriores.
CREATE TABLE `governance_frameworks` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `code` VARCHAR(50) NOT NULL,
 `name` VARCHAR(100) NOT NULL,
 `version_label` VARCHAR(50) NOT NULL,
 `description` TEXT NULL,
 `status` VARCHAR(30) NOT NULL,
 `version` INTEGER NOT NULL,
 `created_at` DATETIME(3) NOT NULL,
 `updated_at` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE UNIQUE INDEX `governance_frameworks_scope_5` ON `governance_frameworks`(`workspace_id`,`id`);
CREATE UNIQUE INDEX `governance_frameworks_scope_6` ON `governance_frameworks`(`workspace_id`,`code`);
CREATE TABLE `framework_sections` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `framework_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `parent_section_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `code` VARCHAR(50) NOT NULL,
 `name` VARCHAR(100) NOT NULL,
 `description` TEXT NULL,
 `position` INTEGER NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE UNIQUE INDEX `framework_sections_scope_4` ON `framework_sections`(`workspace_id`,`framework_id`,`id`);
CREATE UNIQUE INDEX `framework_sections_scope_5` ON `framework_sections`(`workspace_id`,`framework_id`,`code`);
CREATE TABLE `governance_controls` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `framework_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `section_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `code` VARCHAR(50) NOT NULL,
 `title` VARCHAR(250) NOT NULL,
 `description` TEXT NULL,
 `weight` INTEGER NOT NULL,
 `active` BOOLEAN NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE UNIQUE INDEX `governance_controls_scope_3` ON `governance_controls`(`workspace_id`,`framework_id`,`id`);
CREATE UNIQUE INDEX `governance_controls_scope_4` ON `governance_controls`(`workspace_id`,`framework_id`,`code`);
CREATE TABLE `assessments` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `framework_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `name` VARCHAR(100) NOT NULL,
 `status` VARCHAR(30) NOT NULL,
 `assessment_date` DATE NOT NULL,
 `framework_snapshot` JSON NOT NULL,
 `closed_at` DATETIME(3) NULL,
 `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `version` INTEGER NOT NULL,
 `created_at` DATETIME(3) NOT NULL,
 `updated_at` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE UNIQUE INDEX `assessments_scope_2` ON `assessments`(`workspace_id`,`framework_id`,`id`);
CREATE UNIQUE INDEX `assessments_scope_3` ON `assessments`(`workspace_id`,`id`);
CREATE INDEX `assessments_scope_4` ON `assessments`(`workspace_id`,`framework_id`,`status`);
CREATE TABLE `control_assessments` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `framework_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `assessment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `control_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `control_snapshot` JSON NOT NULL,
 `status` VARCHAR(30) NOT NULL,
 `score` INTEGER NULL,
 `justification` TEXT NULL,
 `assessed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `assessed_at` DATETIME(3) NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE UNIQUE INDEX `control_assessments_scope_4` ON `control_assessments`(`workspace_id`,`id`);
CREATE UNIQUE INDEX `control_assessments_scope_5` ON `control_assessments`(`workspace_id`,`assessment_id`,`control_id`);
CREATE TABLE `evidence_links` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `control_assessment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `evidence_type` VARCHAR(30) NOT NULL,
 `reference_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `url` VARCHAR(2048) NULL,
 `title` VARCHAR(250) NOT NULL,
 `valid_until` DATE NULL,
 `attachment_snapshot` JSON NULL,
 `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `created_at` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE INDEX `evidence_links_scope_2` ON `evidence_links`(`workspace_id`,`control_assessment_id`);
CREATE TABLE `governance_goals` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `framework_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `name` VARCHAR(100) NOT NULL,
 `description` TEXT NULL,
 `goal_type` VARCHAR(30) NOT NULL,
 `operator` VARCHAR(30) NOT NULL,
 `target_value` DOUBLE NOT NULL,
 `deadline` DATE NULL,
 `status` VARCHAR(30) NOT NULL,
 `last_result` JSON NULL,
 `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `version` INTEGER NOT NULL,
 `created_at` DATETIME(3) NOT NULL,
 `updated_at` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE UNIQUE INDEX `governance_goals_scope_4` ON `governance_goals`(`workspace_id`,`id`);
CREATE INDEX `governance_goals_scope_5` ON `governance_goals`(`workspace_id`,`project_id`,`status`);
CREATE TABLE `action_plans` (
 `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `control_assessment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `goal_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `title` VARCHAR(250) NOT NULL,
 `description` TEXT NULL,
 `owner_member_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 `status` VARCHAR(30) NOT NULL,
 `due_date` DATE NULL,
 `completed_at` DATETIME(3) NULL,
 `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `version` INTEGER NOT NULL,
 `created_at` DATETIME(3) NOT NULL,
 `updated_at` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
CREATE INDEX `action_plans_scope_4` ON `action_plans`(`workspace_id`,`status`);
-- Indexes for nullable/composite foreign keys are declared explicitly.
CREATE INDEX `framework_sections_parent_idx` ON `framework_sections`(`workspace_id`,`framework_id`,`parent_section_id`);
CREATE INDEX `governance_controls_section_idx` ON `governance_controls`(`workspace_id`,`framework_id`,`section_id`);
CREATE INDEX `control_assessments_assessment_idx` ON `control_assessments`(`workspace_id`,`framework_id`,`assessment_id`);
CREATE INDEX `control_assessments_control_idx` ON `control_assessments`(`workspace_id`,`framework_id`,`control_id`);
CREATE INDEX `evidence_links_attachment_idx` ON `evidence_links`(`workspace_id`,`reference_id`);
CREATE INDEX `governance_goals_framework_idx` ON `governance_goals`(`workspace_id`,`framework_id`);
CREATE INDEX `action_plans_control_idx` ON `action_plans`(`workspace_id`,`control_assessment_id`);
CREATE INDEX `action_plans_goal_idx` ON `action_plans`(`workspace_id`,`goal_id`);
CREATE INDEX `action_plans_owner_idx` ON `action_plans`(`workspace_id`,`owner_member_id`);
ALTER TABLE `governance_frameworks` ADD CONSTRAINT `governance_frameworks_fk_0` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `governance_frameworks` ADD CONSTRAINT `governance_frameworks_status_check` CHECK (`status` IN ('DRAFT','ACTIVE','ARCHIVED'));
ALTER TABLE `governance_frameworks` ADD CONSTRAINT `governance_frameworks_version_check` CHECK (version >= 1);
ALTER TABLE `framework_sections` ADD CONSTRAINT `framework_sections_fk_0` FOREIGN KEY (`workspace_id`,`framework_id`) REFERENCES `governance_frameworks` (`workspace_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `framework_sections` ADD CONSTRAINT `framework_sections_fk_1` FOREIGN KEY (`workspace_id`,`framework_id`,`parent_section_id`) REFERENCES `framework_sections` (`workspace_id`,`framework_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `framework_sections` ADD CONSTRAINT `framework_sections_position_check` CHECK (position BETWEEN 1 AND 1000000);
ALTER TABLE `governance_controls` ADD CONSTRAINT `governance_controls_fk_0` FOREIGN KEY (`workspace_id`,`framework_id`) REFERENCES `governance_frameworks` (`workspace_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `governance_controls` ADD CONSTRAINT `governance_controls_fk_1` FOREIGN KEY (`workspace_id`,`framework_id`,`section_id`) REFERENCES `framework_sections` (`workspace_id`,`framework_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `governance_controls` ADD CONSTRAINT `governance_controls_weight_check` CHECK (weight BETWEEN 1 AND 1000);
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_fk_0` FOREIGN KEY (`workspace_id`,`framework_id`) REFERENCES `governance_frameworks` (`workspace_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_status_check` CHECK (`status` IN ('DRAFT','IN_PROGRESS','CLOSED'));
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_version_check` CHECK (version >= 1);
ALTER TABLE `control_assessments` ADD CONSTRAINT `control_assessments_fk_0` FOREIGN KEY (`workspace_id`,`framework_id`,`assessment_id`) REFERENCES `assessments` (`workspace_id`,`framework_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `control_assessments` ADD CONSTRAINT `control_assessments_fk_1` FOREIGN KEY (`workspace_id`,`framework_id`,`control_id`) REFERENCES `governance_controls` (`workspace_id`,`framework_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `control_assessments` ADD CONSTRAINT `control_assessments_status_check` CHECK (`status` IN ('NOT_ASSESSED','NOT_MET','PARTIALLY_MET','MET','NOT_APPLICABLE'));
ALTER TABLE `control_assessments` ADD CONSTRAINT `control_assessments_score_check` CHECK (score IS NULL OR score IN (0,50,100));
ALTER TABLE `evidence_links` ADD CONSTRAINT `evidence_links_fk_0` FOREIGN KEY (`workspace_id`,`control_assessment_id`) REFERENCES `control_assessments` (`workspace_id`,`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `evidence_links` ADD CONSTRAINT `evidence_links_fk_1` FOREIGN KEY (`workspace_id`,`reference_id`) REFERENCES `attachments` (`workspace_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `evidence_links` ADD CONSTRAINT `evidence_links_evidence_type_check` CHECK (`evidence_type` IN ('ATTACHMENT','URL'));
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_fk_0` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_fk_1` FOREIGN KEY (`workspace_id`,`project_id`) REFERENCES `projects` (`workspace_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_fk_2` FOREIGN KEY (`workspace_id`,`framework_id`) REFERENCES `governance_frameworks` (`workspace_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_goal_type_check` CHECK (`goal_type` IN ('AUTOMATION_COVERAGE','CRITICAL_DEFECTS','GOVERNANCE_SCORE'));
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_operator_check` CHECK (`operator` IN ('GT','GTE','EQ','LTE','LT'));
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_target_value_check` CHECK (target_value BETWEEN 0 AND 1000000000);
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_status_check` CHECK (`status` IN ('ACTIVE','ACHIEVED','MISSED','CANCELLED'));
ALTER TABLE `governance_goals` ADD CONSTRAINT `governance_goals_version_check` CHECK (version >= 1);
ALTER TABLE `action_plans` ADD CONSTRAINT `action_plans_fk_0` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `action_plans` ADD CONSTRAINT `action_plans_fk_1` FOREIGN KEY (`workspace_id`,`control_assessment_id`) REFERENCES `control_assessments` (`workspace_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `action_plans` ADD CONSTRAINT `action_plans_fk_2` FOREIGN KEY (`workspace_id`,`goal_id`) REFERENCES `governance_goals` (`workspace_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `action_plans` ADD CONSTRAINT `action_plans_fk_3` FOREIGN KEY (`workspace_id`,`owner_member_id`) REFERENCES `workspace_members` (`workspace_id`,`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `action_plans` ADD CONSTRAINT `action_plans_status_check` CHECK (`status` IN ('OPEN','IN_PROGRESS','DONE','CANCELLED'));
ALTER TABLE `action_plans` ADD CONSTRAINT `action_plans_version_check` CHECK (version >= 1);
ALTER TABLE evidence_links ADD CONSTRAINT evidence_links_shape_check CHECK ((evidence_type='ATTACHMENT' AND reference_id IS NOT NULL AND url IS NULL AND attachment_snapshot IS NOT NULL AND JSON_TYPE(attachment_snapshot) != 'NULL') OR (evidence_type='URL' AND reference_id IS NULL AND url IS NOT NULL AND (attachment_snapshot IS NULL OR JSON_TYPE(attachment_snapshot) = 'NULL')));
ALTER TABLE governance_goals ADD CONSTRAINT governance_goals_scope_check CHECK ((goal_type='GOVERNANCE_SCORE' AND framework_id IS NOT NULL AND project_id IS NULL) OR (goal_type IN ('AUTOMATION_COVERAGE','CRITICAL_DEFECTS') AND framework_id IS NULL));
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000030','governance.read','Consultar governança'),('00000000-0000-4000-8000-000000000031','governance.assess','Avaliar controles e evidências'),('00000000-0000-4000-8000-000000000032','governance.manage','Gerenciar definições, metas e ações');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code) SELECT UUID(),r.workspace_id,r.id,p.code FROM roles r CROSS JOIN permissions p WHERE r.system_role=1 AND r.normalized_name='administrator' AND p.code IN ('governance.read','governance.assess','governance.manage');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code) SELECT UUID(),workspace_id,id,'governance.read' FROM roles WHERE system_role=1 AND normalized_name='member';
ALTER TABLE assessments ADD CONSTRAINT assessments_closed_check CHECK ((status='CLOSED' AND closed_at IS NOT NULL) OR (status!='CLOSED' AND closed_at IS NULL));
ALTER TABLE action_plans ADD CONSTRAINT action_plans_completed_check CHECK ((status='DONE' AND completed_at IS NOT NULL) OR (status!='DONE' AND completed_at IS NULL));
ALTER TABLE control_assessments ADD CONSTRAINT control_assessments_result_check CHECK ((status IN ('NOT_ASSESSED','NOT_APPLICABLE') AND score IS NULL) OR (status='MET' AND score=100 AND score IS NOT NULL) OR (status='PARTIALLY_MET' AND score=50 AND score IS NOT NULL) OR (status='NOT_MET' AND score=0 AND score IS NOT NULL));
ALTER TABLE control_assessments ADD CONSTRAINT control_assessments_na_check CHECK (status!='NOT_APPLICABLE' OR (justification IS NOT NULL AND LENGTH(TRIM(justification))>0));
