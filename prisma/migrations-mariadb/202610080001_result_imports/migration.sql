-- Résultats externos preservam a definição/passos do snapshot.
ALTER TABLE test_run_cases
  ADD COLUMN result_origin VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN external_result JSON NULL;
CREATE TABLE test_result_imports (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  project_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  test_run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  run_version INT NOT NULL, file_name VARCHAR(250) NOT NULL,
  file_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  items JSON NOT NULL, created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL,
  request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  applied_at DATETIME(3) NULL, applied_version INT NULL, mappings JSON NULL,
  UNIQUE KEY result_imports_request_key (workspace_id,project_id,test_run_id,request_key),
  KEY result_imports_scope_idx (workspace_id,project_id,test_run_id,created_by),
  CONSTRAINT result_imports_run_fk FOREIGN KEY (workspace_id,project_id,test_run_id)
    REFERENCES test_runs (workspace_id,project_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_nopad_ci;
