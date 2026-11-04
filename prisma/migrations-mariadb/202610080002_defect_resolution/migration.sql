-- Sem backfill: updated_at e auditoria sem payload não comprovam resolução histórica.
ALTER TABLE defects ADD COLUMN resolved_at DATETIME(3) NULL;
