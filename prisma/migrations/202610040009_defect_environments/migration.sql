ALTER TABLE environments ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'OTHER';
ALTER TABLE environments ADD CONSTRAINT environments_category_check CHECK (category IN ('PRODUCTION','HOMOLOGATION','OTHER'));
ALTER TABLE defects ADD COLUMN environment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN environment_snapshot JSON NULL;
CREATE INDEX defects_environment_period_idx ON defects(workspace_id, project_id, environment_id, created_at);
ALTER TABLE defects ADD CONSTRAINT defects_environment_fk FOREIGN KEY (workspace_id, project_id, environment_id)
  REFERENCES environments(workspace_id, project_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION;
