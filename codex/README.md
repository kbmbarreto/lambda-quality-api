# Lambda Quality — Especificação do backend

Identidade atualizada em 04/11/2026: projeto open source da Lambda Team,
licença MIT e instalação nova, sem migração de dados anteriores.
Consulte as [decisões de identidade e compatibilidade](PRODUCT_IDENTITY.md).

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](MARIADB_COMPATIBILITY.md).

Baseline técnica revisada em **30/09/2026**. A implementação iniciou com
bootstrap, Swagger e identidade (cadastro por código, login, refresh/logout
e recuperação de senha). A Fase 01 de Workspace foi implementada em
02/10/2026, com membros/convites, ownership, RBAC/grupos, campos, tags e anexos.
Fase 02 de Projetos implementada, com participantes, marcos e ambientes.
Fase 03 de Casos de Teste implementada: suítes, casos/passos e vínculos/valores.
Planos e Execuções implementados na Fase 04: snapshots, resultados e comentários.
Defeitos implementados na Fase 05, com vínculos a falhas/anexos e referências
externas. Governança implementada na Fase 06 em 03/10/2026: frameworks, avaliações,
evidências, metas, ações e dashboard. Requisitos e integrações permanecem no backlog.

## Stack e convenções

Operação: [CI/CD de homologação, Docker, migrations e rollback](CICD_HML.md).

| Área         | Direção                                                         |
| ------------ | --------------------------------------------------------------- |
| Linguagem    | TypeScript, modo `strict`                                       |
| Runtime      | Node.js 24.x, patch atualizado dentro dessa linha               |
| Framework    | NestJS, monólito modular orientado a domínio                    |
| Banco        | MySQL 8; baseline MySQL 8.4 LTS, InnoDB e utf8mb4               |
| Persistência | Prisma ORM, isolado nos adapters de infraestrutura              |
| Schema       | Migrations SQL versionadas e revisadas, gerenciadas pelo Prisma |
| Pacotes      | npm e `package-lock.json`; instalação reproduzível com `npm ci` |
| Módulos      | ESM; validar configuração TypeScript/NestJS/Prisma no bootstrap |
| Validação    | DTOs e validação em runtime; tipos TypeScript não validam JSON  |
| Autenticação | JWT bearer + refresh token opaco rotativo                       |
| Contratos    | OpenAPI, sucesso em JSON e erro em Problem Details (RFC 9457)   |
| Testes       | Vitest, Supertest e Testcontainers para Node.js com MySQL real  |
| Qualidade    | ESLint, Prettier e verificação de dependências entre módulos    |

TypeScript/Node.js 24 e MySQL 8 são requisitos do projeto. NestJS, Prisma,
Vitest e MySQL 8.4 são as escolhas técnicas adotadas nesta revisão para
tornar o plano executável; alterações devem ser registradas antes de
implementar a parte afetada. As versões exatas estão fixadas em package.json
e package-lock.json; Prisma 7.10 e NestJS 11 são a base desta entrega. Os
testes de integração usam MySQL 8.4.11, em container ou schema descartável.

## Ordem de leitura

Para uma visão inicial dos relacionamentos, consulte o
[mapa mental do projeto](DOMAIN_MODEL.md#mapa-mental-do-projeto).

1. [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)
2. [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
3. [ENTITIES.md](ENTITIES.md)
4. [SECURITY_AND_TENANCY.md](SECURITY_AND_TENANCY.md)
5. [DATABASE_MODEL.md](DATABASE_MODEL.md)
6. [USE_CASES.md](USE_CASES.md)
7. [API_SPEC.md](API_SPEC.md)
8. [CODEX_IMPLEMENTATION_PLAN.md](CODEX_IMPLEMENTATION_PLAN.md)
9. [CODEX_PROMPT.md](CODEX_PROMPT.md)

[Lambda_Quality_Ideias_Iniciais.md](Lambda_Quality_Ideias_Iniciais.md) é a
referência de visão do produto, com ideias futuras; não autoriza ampliar o
escopo das fases. Os documentos técnicos acima regem a implementação.
Se houver conflito entre eles, resolvê-lo e documentá-lo antes de codificar.

**Regra:** decisões estruturais, relacionamentos, isolamento multi-tenant
e contratos não devem ser alterados silenciosamente.

## Planejamentos por funcionalidade

- [Workspace: membros, convites, roles, grupos e extensões](WORKSPACE_DEVELOPMENT_PLAN.md).
  Fase 01 única, incluindo campos personalizados, tags e anexos; Shared
  parameters e Shared steps excluídos. Planejamento revisado em 02/10/2026.
- [Decisões efetivamente adotadas na Fase 01](WORKSPACE_IMPLEMENTATION_DECISIONS.md).
  Contratos disponíveis: [front-specs](../front-specs/README.md) e `/docs-json`.
- [Decisões de Projetos — Fase 02](PROJECT_IMPLEMENTATION_DECISIONS.md),
  com [guia front-end](../front-specs/projects.md) e 19 endpoints.

A sequência atual é **Workspaces → Projetos → Casos de Teste → Planos e
Execuções → Defeitos → Governança**, conforme o
[plano principal](CODEX_IMPLEMENTATION_PLAN.md). Bootstrap/identidade são
a base já entregue; requisitos e integrações ficam no backlog sem fase definida.

- [Decisões de Casos de Teste — Fase 03](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md),
  com [guia front-end](../front-specs/test-cases.md) e 26 endpoints, incluindo contagens do repositório em 03/10/2026.

## Documentação para o front-end

[front-specs/](../front-specs/README.md) reúne os guias de integração por
funcionalidade. Criar/atualizar as instruções de cada endpoint na mesma
entrega, seguindo o [modelo](../front-specs/ENDPOINT_TEMPLATE.md). Esses
guias integram o aceite das fases e devem acompanhar alterações de contrato.

## Referências técnicas

- [Requisitos e estrutura do NestJS](https://docs.nestjs.com/first-steps).
- [Requisitos de runtime do Prisma](https://docs.prisma.io/docs/orm/reference/system-requirements)
  e [bancos suportados](https://docs.prisma.io/docs/orm/reference/supported-databases).
- [Tipos temporais do MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-type-syntax.html).
- [Problem Details — RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html).
- [Segurança e rotação de refresh tokens — RFC 9700, seção 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).
- [Armazenamento de senhas — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

- [Decisões de Planos e Execuções — Fase 04](EXECUTION_IMPLEMENTATION_DECISIONS.md),
  [contratos](../front-specs/execution-contracts.md) e [24 endpoints](../front-specs/execution.md).

- [Decisões de Defeitos — Fase 05](DEFECT_IMPLEMENTATION_DECISIONS.md),
  [contratos](../front-specs/defect-contracts.md) e [10 endpoints](../front-specs/defects.md).

- [Decisões de Governança — Fase 06](GOVERNANCE_IMPLEMENTATION_DECISIONS.md),
  [contratos](../front-specs/governance-contracts.md) e [33 endpoints](../front-specs/governance.md).

- [Visão geral do produto — 04/10/2026](DASHBOARD_IMPLEMENTATION_DECISIONS.md),
  [contrato do Início](../front-specs/dashboard.md); nova rota consolidada,
  com extensões aditivas de governança/ambientes abaixo. OpenAPI atual: 172 operações.

## Extensões de 04/10/2026

- [Progresso de frameworks e metas por seção](../front-specs/framework-progress.md): leitura com snapshots e bloco frameworkGovernance na overview.
- [Ambientes e gráficos de bugs](../front-specs/defect-analytics.md): cadastro de ambientes para o front, associação no defeito e agregações por mês/projeto/categoria.
- Migrations aditivas `202610040008_framework_progress_goals` e `202610040009_defect_environments` nas duas histórias. Aplicar com `npm run migration:deploy` antes de reiniciar a API; não usar reset/db push.

- [Anexos privados no Oracle OCI](OCI_STORAGE_IMPLEMENTATION_DECISIONS.md):
  upload/download/limpeza no Object Storage, configuração Docker e migração
  explícita dos arquivos locais, sem alteração do contrato HTTP ou do banco.
  Em 05/10/2026, OCI é inicializado sob demanda; falhas permitem startup e retornam
  `503 ATTACHMENT_STORAGE_UNAVAILABLE` nas operações de arquivo, com mensagem ao usuário.

## Evoluções de 06/10/2026

[Decisões e operação](PRODUCT_IMPROVEMENTS_20261006.md): importação CSV de casos
Azure DevOps autorizada nesta entrega, inventário de defeitos, cofre por projeto,
creationOrder e timestamps HTTP -03:00. Integrações remotas permanecem no backlog.
[Instruções para o front](../front-specs/product-improvements.md). OpenAPI: 179 operações.

## Evoluções de 07/10/2026

[Indicadores de automação na overview](DASHBOARD_IMPLEMENTATION_DECISIONS.md):
casos ativos e proporção consolidada de AUTOMATED no catálogo atual, com grants
por fonte e sem alterar execução. [Contrato do front](../front-specs/dashboard.md).
Sem migration ou nova rota; OpenAPI permanece com 179 operações.

[Vínculo de ações existentes a metas](GOVERNANCE_IMPLEMENTATION_DECISIONS.md):
PATCH de ações aceita goalId com versão atual, autorização de origem/destino
e preservação de snapshots. [Guia do front](../front-specs/governance.md).
Sem migration ou nova operação.

[Conclusão das metas por ações](../front-specs/goal-action-completion.md):
atingimento automático com todas as ações válidas concluídas, progresso atual
no painel e independência de frameworks/avaliações. Sem migration ou nova rota.

[Total global ACTIVE e todo o período ALL](../front-specs/dashboard.md):
metrics.activeTestCases e period.supportedDays na overview, histórico completo
com grants atuais e comparações anteriores null. Sem migration ou nova rota.

## Evoluções de 08/10/2026

[Cofre e uso autenticado sem quota geral](PRODUCT_IMPROVEMENTS_20261006.md):
validação/geração local segura de chave AES-256, diagnóstico sem segredos e
retirada do limite compartilhado das operações de negócio. Proteções de login,
refresh, códigos e cooldown de convites preservadas. [Guia do cofre](../front-specs/test-vault.md)
e [índice do front](../front-specs/README.md). Sem migration ou nova operação.

[JUnit, lotes e inventários de execuções/projetos](EXECUTION_IMPORTS_20261008.md):
seis rotas novas e origem auditável de resultado externo. PASSED importado
preserva passos pendentes; execução manual mantém sua regra. Migration aditiva
`202610080001_result_imports` nos dois dialetos. [Guia do front](../front-specs/execution-imports-and-inventories.md).
OpenAPI atual: 185 operações.

[Indicadores globais de defeitos e marco de resolução](DEFECT_SUMMARY_20261008.md):
nova rota `/defects/summary`, média da criação até resolução confirmada pelo
produto e `resolvedAt` aditivo. Migration `202610080002_defect_resolution` nos
dois dialetos; sem backfill de legados. [Guia do front](../front-specs/defect-summary.md).
OpenAPI atual: 186 operações.

## Evoluções de 09/10/2026

[Comentários e histórico de defeitos](DEFECT_HISTORY_20261009.md): PATCH com comment
e GET /history paginado, transacionais com version/auditoria. Migration aditiva
`202610090001_defect_history` nos dois dialetos recupera eventos legados sem
inventar campos ausentes. [Guia do front](../front-specs/defect-history.md).
Contagem atual OPEN continua no inventário. OpenAPI atual: 187 operações.
