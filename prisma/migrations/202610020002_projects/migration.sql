-- CreateTable
CREATE TABLE `projects` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `key` VARCHAR(12) COLLATE utf8mb4_0900_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `archived_at` DATETIME(3) NULL,

    INDEX `projects_workspace_id_status_idx`(`workspace_id`, `status`),
    UNIQUE INDEX `projects_workspace_id_id_key`(`workspace_id`, `id`),
    UNIQUE INDEX `projects_workspace_id_key_key`(`workspace_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `project_members` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_member_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_role` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_members_workspace_id_workspace_member_id_idx`(`workspace_id`, `workspace_member_id`),
    UNIQUE INDEX `project_members_workspace_id_project_id_workspace_member_id_key`(`workspace_id`, `project_id`, `workspace_member_id`),
    UNIQUE INDEX `project_members_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `milestones` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `status` VARCHAR(20) NOT NULL,
    `start_date` DATE NULL,
    `due_date` DATE NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `milestones_workspace_id_project_id_deleted_at_status_idx`(`workspace_id`, `project_id`, `deleted_at`, `status`),
    UNIQUE INDEX `milestones_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `environments` (
    `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `workspace_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `normalized_name` VARCHAR(100) COLLATE utf8mb4_0900_bin NOT NULL,
    `description` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `environments_workspace_id_project_id_deleted_at_active_idx`(`workspace_id`, `project_id`, `deleted_at`, `active`),
    UNIQUE INDEX `environments_workspace_id_project_id_id_key`(`workspace_id`, `project_id`, `id`),
    UNIQUE INDEX `environments_workspace_id_project_id_normalized_name_key`(`workspace_id`, `project_id`, `normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_workspace_id_workspace_member_id_fkey` FOREIGN KEY (`workspace_id`, `workspace_member_id`) REFERENCES `workspace_members`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `milestones` ADD CONSTRAINT `milestones_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `environments` ADD CONSTRAINT `environments_workspace_id_project_id_fkey` FOREIGN KEY (`workspace_id`, `project_id`) REFERENCES `projects`(`workspace_id`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Catálogo e evolução explícita das roles de sistema; customizadas inalteradas.
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000013', 'project.read', 'project.read');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000014', 'project.create', 'project.create');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000015', 'project.update', 'project.update');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000016', 'project.archive', 'project.archive');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000017', 'project.manage_members', 'project.manage_members');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000018', 'project.manage_all', 'project.manage_all');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000019', 'milestone.manage', 'milestone.manage');
INSERT INTO permissions (id,code,description) VALUES ('00000000-0000-4000-8000-000000000020', 'environment.manage', 'environment.manage');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),r.workspace_id,r.id,p.code FROM roles r CROSS JOIN permissions p
WHERE r.system_role = 1 AND r.normalized_name = 'administrator' AND p.code IN ('project.read','project.create','project.update','project.archive','project.manage_members','project.manage_all','milestone.manage','environment.manage');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
SELECT UUID(),workspace_id,id,'project.read' FROM roles WHERE system_role = 1 AND normalized_name = 'member';
ALTER TABLE projects ADD CONSTRAINT project_status_check CHECK (status IN ('ACTIVE','ARCHIVED')),
ADD CONSTRAINT project_archive_check CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL)),
ADD CONSTRAINT project_key_check CHECK (REGEXP_LIKE(`key`, '^[A-Z][A-Z0-9_]{1,11}$','c'));
ALTER TABLE project_members ADD CONSTRAINT project_role_check CHECK (project_role IN ('VIEWER','EDITOR','MANAGER'));
ALTER TABLE milestones ADD CONSTRAINT milestone_status_check CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
ADD CONSTRAINT milestone_dates_check CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
ADD CONSTRAINT milestone_complete_check CHECK ((status = 'COMPLETED' AND completed_at IS NOT NULL) OR (status <> 'COMPLETED' AND completed_at IS NULL));
ALTER TABLE environments ADD CONSTRAINT environment_delete_check CHECK (deleted_at IS NULL OR active = FALSE);
