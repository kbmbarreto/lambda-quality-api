-- Projeções do dashboard: janelas UTC e cobertura distinta por tenant/projeto.
-- Somente índices aditivos; não reescreve registros nem resultados históricos.
CREATE INDEX `test_runs_dashboard_period_idx` ON `test_runs` (`workspace_id`, `project_id`, `created_at`);
CREATE INDEX `run_cases_dashboard_coverage_idx` ON `test_run_cases` (`workspace_id`, `project_id`, `executed_at`, `test_case_id`, `result`);
CREATE INDEX `defects_dashboard_period_idx` ON `defects` (`workspace_id`, `project_id`, `created_at`);
