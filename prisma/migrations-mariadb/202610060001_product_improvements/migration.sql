-- Sequência técnica: UUID v4/code não recuperam a ordem histórica individual.
ALTER TABLE governance_controls ADD COLUMN creation_order INT NOT NULL AUTO_INCREMENT,
  ADD UNIQUE KEY governance_controls_creation_order_key (creation_order);
CREATE INDEX governance_controls_creation_idx ON governance_controls (workspace_id, framework_id, creation_order);

CREATE TABLE test_case_imports (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, project_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  file_hash CHAR(64) NOT NULL, cases JSON NOT NULL,
  created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, created_at DATETIME(3) NOT NULL,
  UNIQUE KEY test_case_imports_workspace_id_project_id_file_hash_key (workspace_id, project_id, file_hash),
  CONSTRAINT test_case_imports_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id, id) ON DELETE RESTRICT ON UPDATE NO ACTION
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;

CREATE TABLE test_vault_entries (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, project_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, environment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  name VARCHAR(100) NOT NULL, encrypted_payload LONGTEXT NOT NULL, key_id VARCHAR(50) NOT NULL,
  version INT NOT NULL, created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL, deleted_at DATETIME(3) NULL,
  UNIQUE KEY test_vault_entries_workspace_id_project_id_id_key (workspace_id, project_id, id),
  KEY test_vault_entries_list_idx (workspace_id, project_id, deleted_at, name),
  KEY test_vault_entries_environment_idx (workspace_id, project_id, environment_id),
  CONSTRAINT test_vault_entries_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT test_vault_entries_environment_fk FOREIGN KEY (workspace_id,project_id,environment_id)
    REFERENCES environments (workspace_id,project_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
INSERT INTO permissions (id,code,description) VALUES
  ('a6060001-0000-4000-8000-000000000001','testvault.read','Consultar metadados do cofre de testes'),
  ('a6060001-0000-4000-8000-000000000002','testvault.manage','Gerenciar dados criptografados do cofre de testes'),
  ('a6060001-0000-4000-8000-000000000003','testvault.reveal','Revelar credenciais do cofre de testes');
INSERT INTO role_permissions (id,workspace_id,role_id,permission_code)
  SELECT UUID(),r.workspace_id,r.id,p.code FROM roles r CROSS JOIN permissions p
  WHERE r.system_role=TRUE AND r.normalized_name='administrator' AND p.code LIKE 'testvault.%';
