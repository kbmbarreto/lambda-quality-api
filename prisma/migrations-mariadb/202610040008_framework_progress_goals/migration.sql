-- Existing goals retain their framework scope and no assigned owner.
ALTER TABLE governance_goals
  ADD COLUMN section_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN owner_member_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
CREATE INDEX governance_goals_section_idx ON governance_goals(workspace_id, framework_id, section_id);
CREATE INDEX governance_goals_owner_idx ON governance_goals(workspace_id, owner_member_id);
ALTER TABLE governance_goals ADD CONSTRAINT governance_goals_section_fk
  FOREIGN KEY (workspace_id, framework_id, section_id) REFERENCES framework_sections(workspace_id, framework_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE governance_goals ADD CONSTRAINT governance_goals_owner_fk
  FOREIGN KEY (workspace_id, owner_member_id) REFERENCES workspace_members(workspace_id, id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE governance_goals ADD CONSTRAINT governance_goals_section_scope_check
  CHECK (section_id IS NULL OR (goal_type = 'GOVERNANCE_SCORE' AND framework_id IS NOT NULL AND project_id IS NULL));
