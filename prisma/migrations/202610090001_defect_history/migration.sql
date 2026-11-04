-- Histórico durável; nenhuma reconstrução de transições ou comentários ausentes.
CREATE TABLE defect_history_events (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  project_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  defect_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  type VARCHAR(20) NOT NULL,
  actor_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  actor_display_name VARCHAR(100) NULL,
  created_at DATETIME(3) NOT NULL,
  from_status VARCHAR(20) NULL, to_status VARCHAR(20) NULL, comment TEXT NULL,
  INDEX defect_history_list_idx (workspace_id,project_id,defect_id,created_at,id),
  CONSTRAINT defect_history_defect_fk FOREIGN KEY (workspace_id,project_id,defect_id)
    REFERENCES defects (workspace_id,project_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT defect_history_type_check CHECK (type IN ('CREATED','UPDATED')),
  CONSTRAINT defect_history_from_check CHECK (from_status IS NULL OR from_status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED','REJECTED')),
  CONSTRAINT defect_history_to_check CHECK (to_status IS NULL OR to_status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED','REJECTED')),
  CONSTRAINT defect_history_comment_check CHECK (comment IS NULL OR CHAR_LENGTH(TRIM(comment)) BETWEEN 1 AND 10000)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- Identidade preservada sem vínculo a membership; o nome histórico não consta na auditoria.
INSERT INTO defect_history_events
  (id,workspace_id,project_id,defect_id,type,actor_user_id,actor_display_name,created_at,from_status,to_status,comment)
SELECT a.id,d.workspace_id,d.project_id,d.id,
  CASE WHEN a.action IN ('defect.created','defect.created_from_failure') THEN 'CREATED' ELSE 'UPDATED' END,
  a.actor_user_id,NULL,a.occurred_at,NULL,NULL,NULL
FROM audit_events a INNER JOIN defects d ON d.id=a.entity_id AND d.workspace_id=a.workspace_id
WHERE a.entity_type='Defect' AND a.action LIKE 'defect.%';
