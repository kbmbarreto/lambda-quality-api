# Modelo de banco — MySQL 8

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](MARIADB_COMPATIBILITY.md).

## Convenções

- MySQL **8.4 LTS** como baseline, com a mesma versão em desenvolvimento,
  integração e produção; patch/imagem fixados no bootstrap.
- Engine InnoDB, charset `utf8mb4`, nomes `snake_case`.
- IDs técnicos UUID gerados pela aplicação e armazenados como `CHAR(36)`
  ASCII com collation `ascii_bin`. Mesmo tipo/collation em todas as FKs.
- Timestamps `DATETIME(3)` em UTC; conexões e aplicação configuradas em UTC.
  Esse tipo não armazena fuso. Datas de calendário usam `DATE`.
- `workspace_id` obrigatório em recursos tenant-scoped, inclusive junções.
  `users`, `auth_sessions`, `refresh_tokens`, `email_challenges`,
  `email_code_scopes` e `permissions` são globais.
- FKs, índices, uniques e constraints explícitos em migrations SQL.
- Texto geral com collation `utf8mb4_0900_ai_ci`; hashes, tokens e códigos
  que exigem comparação exata usam collation binária apropriada.
- Definir normalização para email, slug e project key antes de persistir;
  unicidade deve refletir a comparação adotada pelo produto.
- Migrations SQL revisadas em `prisma/migrations/`, gerenciadas pelo Prisma;
  não usar sincronização automática de schema. `schema.prisma` e migrations
  devem representar as mesmas constraints, documentando SQL adicional.
- Scripts npm encapsulam a CLI da versão Prisma fixada; geração local e
  aplicação em CI/produção são operações distintas. Não executar reset ou
  geração interativa em produção; migrations MySQL DDL não são tratadas como
  transações com rollback automático. Documentar recuperação de falhas.
- Campos `version` para concorrência otimista conforme necessidade; SQL
  parametrizado quando houver operação não expressa pelo ORM.

Referências: [tipos temporais](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-type-syntax.html)
e [FKs do MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).

## Tabelas

```text
users
auth_sessions
refresh_tokens
email_challenges
email_code_scopes
workspaces
workspace_members
invitations
roles
permissions
role_permissions
member_roles
groups
group_members
group_roles

projects
project_members
milestones
environments

test_suites
test_cases
test_steps
tags
test_case_tags

test_plans
test_plan_cases
test_runs
test_run_cases
test_run_steps

requirements
requirement_test_cases
defects

attachments
attachment_links

governance_frameworks
framework_sections
governance_controls
assessments
control_assessments
evidence_links
governance_goals
action_plans

audit_events
sequence_counters
```

## Identidade e sessões

- `users`: email normalizado único, `password_hash`, status e timestamps;
  nenhum hash/segredo faz parte do DTO público.
- `users` também registra email_verified_at e password_changed_at. Colunas
  de e-mail usam utf8mb4_0900_bin para comparar exatamente o valor normalizado.
- `email_challenges`: finalidade, HMAC do código, elegibilidade, tentativas,
  expiração, consumo e revogação. `email_code_scopes` serializa cooldown por
  hash de e-mail/finalidade. Código em texto puro não é persistido.
- `auth_sessions`: `id`, `user_id`, `created_at`, `expires_at`, `last_used_at`,
  `revoked_at` e `revoke_reason`; uma família por sessão/login.
- `refresh_tokens`: `id`, `session_id`, `token_hash CHAR(64)` ASCII/binário,
  `created_at`, `expires_at`, `consumed_at`, `revoked_at` e
  `replaced_by_token_id` opcional. `token_hash` único; sucessor pertence à
  mesma sessão, reforçado por FK composta `(session_id,replaced_by_token_id)`
  para `(session_id,id)` com unique de destino explícita.
- Índices: sessões por `(user_id,revoked_at,expires_at)`; tokens por
  `(session_id,expires_at)` e lookup único por hash.
- Rotação bloqueia sessão e token em transação, consome token e insere
  sucessor atomicamente. Logout/reuso usam o mesmo bloqueio de sessão.
- Não apagar hashes consumidos antes da expiração absoluta da sessão;
  limpeza posterior respeita a política de retenção de auditoria.

## Constraints e isolamento

- `workspace_members`: unique `(workspace_id,user_id)`.
- `projects`: unique `(workspace_id,key)`.
- `test_steps`: unique `(workspace_id,test_case_id,position)`.
- `test_plan_cases`: unique `(workspace_id,test_plan_id,test_case_id)`.
- `requirement_test_cases`: unique `(workspace_id,requirement_id,test_case_id)`.
- Framework control: unique `(workspace_id,framework_id,code)`.
- Assessment control: unique `(workspace_id,assessment_id,control_id)`.

Pais tenant-scoped expõem unique `(workspace_id,id)`. Filhos referenciam
`(workspace_id,parent_id)` para impedir associação entre tenants. Em
relações escopadas por projeto, usar unique/FK com
`(workspace_id,project_id,id)` onde necessário; adicionar `project_id`
aos registros/junções dependentes quando exigido por essas constraints.
Não confiar apenas em FKs por UUID para manter fronteiras.

Junções RBAC incluem `workspace_id` e referenciam membro/role/group no
mesmo Workspace. Referência a Permission global usa seu code único. Links
polimórficos como AttachmentLink/EvidenceLink exigem validação explícita
no Use Case, porque a FK não valida diferentes tipos de destino.

## Sequências humanas

`sequence_counters(workspace_id,project_id,entity_type,next_value)` com
unique `(workspace_id,project_id,entity_type)`, `project_id NOT NULL` para
os contadores de TestCase/Requirement/Defect previstos nesta versão.

Criar a linha por inserção/upsert seguro sob concorrência e usar lock
transacional `SELECT ... FOR UPDATE` ao reservar e incrementar o valor.
Não usar `MAX()+1`. Exemplos: LQ-141, REQ-31, DEF-82. Para contadores futuros
por Workspace, definir esquema específico; unique com coluna nula não
impede múltiplas linhas equivalentes no MySQL.

## Snapshot e exclusão

`test_run_cases` e `test_run_steps` duplicam intencionalmente campos
necessários à reprodução histórica. Não normalizar esses snapshots de
volta para TestCase/TestStep.

Preferir archive/soft-delete para TestCase, Project, Framework e Attachment
quando houver referência histórica. Runs e AuditEvents não sofrem hard
delete normal; não usar cascades que destruam histórico.
`audit_events.workspace_id` pode ser nulo somente para eventos globais de
identidade; consulta de auditoria de Workspace sempre filtra tenant.

## Índices iniciais

- `(workspace_id,status)` em recursos listáveis.
- `(workspace_id,project_id)` em tabelas de projeto.
- `(workspace_id,project_id,sequence)` unique em TestCase/Requirement/Defect.
- `(workspace_id,test_run_id,result)` em TestRunCase.
- `(workspace_id,framework_id,status)` em Assessment.

## Grupos de migrations sugeridos

1. Base já entregue: identidade/sessões/refresh/desafios e auditoria mínima.
2. Fase 01 — Workspaces: tenant, membros, convites, RBAC/grupos, definições
   de campos personalizados, catálogo de tags e biblioteca de anexos.
3. Fase 02 — Projetos: Project/ProjectMember, Milestone/Environment e
   extensões de escopo por projeto para recursos já entregues quando necessário.
4. Fase 03 — Casos de Teste: suites/cases/steps, valores de campos e
   associações a tags/anexos, com FKs de tenant/projeto.
5. Fase 04 — Planos e Execuções: plans/runs/resultados e snapshots.
6. Fase 05 — Defeitos: Defect e vínculos com execução/anexos.
7. Fase 06 — Governança: frameworks/avaliações/metas/ações e evidências.
8. Backlog sem fase definida: requisitos/rastreabilidade e integrações.

Auditoria evolui junto às mutações de cada fase. A numeração segue o
[plano revisado](CODEX_IMPLEMENTATION_PLAN.md); uma fase pode ter várias
migrations técnicas sem criar entregas separadas. Campos personalizados e
ownership foram consolidados nas
[decisões de Workspace](WORKSPACE_IMPLEMENTATION_DECISIONS.md). Na Fase 01, não criar
FKs para Project/TestCase antes de suas tabelas: evoluir schema/associações
com os consumidores. Shared parameters e Shared steps estão excluídos.

Os nomes e comandos concretos seguem a versão Prisma fixada. Cada fase
inclui suas migrations; gerar a documentação não autoriza executá-las.

## Migration entregue em 30/09/2026

`202609300001_identity` cria somente as tabelas de identidade, desafios,
sessões/tokens e auditoria mínima. O schema Prisma acompanha seus índices
e FKs. Collations ASCII/binárias, collation de e-mail e CHECK de tentativas
não negativas são ajustes SQL explícitos, não expressos pelo schema Prisma.
MySQL 8.4.11 foi usado na verificação. Workspace não é criado por essa migration;
a migration seguinte amplia a base sem apagar dados de identidade.

## Migration de Workspace — 02/10/2026

`202610020001_workspaces` cria Workspace/Member, Invitation, Role/Permission,
Group, RolePermission/MemberRole/GroupMember/GroupRole, CustomFieldDefinition,
Tag e Attachment, com catálogo de 12 permissions. Schema Prisma acompanha
índices/FKs; SQL revisado fixa collations binárias para UUIDs/hashes/chaves e
nomes normalizados, além de CHECKs de status, tipo, alvo, posição, tamanho
e tentativas. Normalização de nomes: trim + NFKC + lowercase na aplicação.

`workspaces.owner_member_id` referencia `(workspace_id,id)` de Member.
Nullable somente para viabilizar o ciclo na criação transacional; API insere
tenant/membro/roles e define Owner antes do commit. Unique membership
`(workspace_id,user_id)`; junções RBAC possuem FKs compostas para seus pais
do mesmo tenant. Slug é único global; role/group/tag usam nome normalizado
único por tenant; campo usa `(workspace_id,target,key)`.

Invitation persiste hash de verificação e intenção de envio cifrada, estado
de entrega e contagem. Campos de ator (invitedBy/acceptedBy/uploadedBy)
são validados pela aplicação; não adicionar silenciosamente FKs novas.
Attachment usa key UUID privada e checksum SHA-256; deletedAt mantém metadados
após limpeza física. Auditoria existente recebe workspaceId nas ações de tenant.
Sem Project, TestCase, valores de campo ou associações de tags/anexos nesta migration.

## Migration de Projetos — Fase 02

`202610020002_projects` adiciona projects/project_members/milestones/environments
sem alterar os dados existentes. FKs compostas referenciam Project e
WorkspaceMember no mesmo tenant. Filhos possuem unique `(workspace_id,project_id,id)`;
ProjectMember usa unique `(workspace_id,project_id,workspace_member_id)`.
Project key uppercase/imutável é única por Workspace (binária); Environment
normalized_name é único por Workspace/Project, inclusive após exclusão lógica.

start_date/due_date usam DATE; application/DTO usam YYYY-MM-DD, sem timestamp.
archived_at/deleted_at/completed_at são DATETIME(3) UTC. CHECKs preservam enums,
key, intervalo de datas e consistência archive/conclusão/desativação.
SQL adicional não é representado integralmente pelo schema Prisma.

Migration insere oito permissions, amplia Administrator existente com as oito
e Member com project.read; grants customizados não mudam. Novos Workspaces
usam o catálogo de 20 permissions. Testes cobrem banco vazio e upgrade com
roles/grants existentes. Remoção de WorkspaceMember limpa ProjectMember junto
às outras concessões; suspensão preserva o vínculo e bloqueia autorização.
Não adiciona projectId a campos/tags/anexos nem cria associações futuras.

## Migration de Casos de Teste — Fase 03

`202610020003_test_management` cria test_suites/test_cases/test_steps,
test_case_tags/test_case_attachments/test_case_field_values e sequence_counters.
FKs compostas incluem Workspace/Project em pais de projeto, tenant em catálogos.
UUIDs CHAR(36) ASCII/binário; texto utf8mb4_0900_ai_ci; timestamps DATETIME(3).
RESTRICT/NO ACTION preservam referências, sem cascades de histórico.
CHECKs SQL adicionais validam enums, positivos, archive/status, pai diferente
de si e JSON escalar. Ciclos profundos, required/tipos e ordem densa são regras
de aplicação sob lock; schema Prisma representa FKs e índices, não os CHECKs.
Upsert + lock transacional reservam sequence; rollback não consome número.
Quatro novas permissions, Administrator com quatro e Member com read;
customizadas preservadas. SQL gerado por Prisma migrate diff e revisado.
Validação usa migrate deploy em bancos descartáveis; MySQL DDL não tem rollback
atômico. Em falha de aplicação da migration, interromper rollout, comparar o
schema e histórico de migrations e reparar/restaurar o banco antes de retomá-lo.
Não executar reset em ambiente com dados.

## Migration de Planos e Execuções — Fase 04

`202610020004_execution` é aditiva: TestPlan, TestPlanCase, TestRun,
TestRunCase, TestRunStep e ExecutionComment. Três permissions; Administrator
recebe as três e Member recebe testrun.read; grants customizados são preservados.
FKs compostas por Workspace/Project/Run/RunCase impedem referências cruzadas.
Posições positivas, únicas e densas na aplicação; seleção não duplica casos.
CHECKs validam version > 0, estados/timestamps, resultados/autor/data, source
MANUAL e formatos JSON dos snapshots. UUIDs mantêm ASCII/binary e textos
utf8mb4_0900_ai_ci. RESTRICT/NO ACTION preservam o histórico.

sourceStepId é informativo sem FK: remoção de TestStep não altera RunStep.
TestCase mantém FK composta RESTRICT e archive; contexto usa exclusão lógica.
Snapshots JSON de definição/campos/tags/contexto são escritos somente na criação;
resultados e comentários ficam em colunas/tabela separadas. Comentário de passo
exige caso da mesma execução. Version e auditoria são atômicos com a escrita.
A implementação/testes verificam banco vazio e upgrade da Fase 03 com dados e
concessões anteriores. [Decisões](EXECUTION_IMPLEMENTATION_DECISIONS.md).

## Migration de Defeitos — Fase 05

`202610020005_defects` cria defects/defect_attachments e unique composto
Workspace/Project/id em RunCase para FK de origem. FK de arquivo é tenant-scoped,
defeito e origem são project-scoped; RESTRICT/NO ACTION, sem cascade histórico.
CHECKs validam versão/sequência positivas, enums e tríade externa toda preenchida
ou toda nula. UUIDs ASCII/binary, textos utf8mb4_0900_ai_ci.

Counter existente admite TEST_CASE/DEFECT; evolução somente do CHECK, mantendo
linhas anteriores. Reserva com upsert/SELECT FOR UPDATE/incremento atômico,
sem MAX()+1; rollback não consome número. Grants customizados preservados;
Administrator recebe ambas novas permissions, Member defect.read.
Snapshots de RunCase/RunStep e tabelas da Fase 04 não são reescritos.
[Decisões](DEFECT_IMPLEMENTATION_DECISIONS.md).

## Fase 06 — Governança entregue

Migration `202610030006_governance` cria oito tabelas incrementais e três permissions.
Framework expõe (workspace_id,id), code único por Workspace. Seção/controle expõem
(workspace_id,framework_id,id), code único por framework e FKs compostas para pai,
framework e seção. Assessment expõe (workspace_id,framework_id,id) e
(workspace_id,id); ControlAssessment liga controle e avaliação no mesmo framework
e é único por (workspace_id,assessment_id,control_id). EvidenceLink usa FK
(workspace_id,control_assessment_id) e (workspace_id,reference_id) para Attachment.
Goal referencia Workspace/Project/Framework; ActionPlan referencia Workspace,
ControlAssessment/Goal/WorkspaceMember. RESTRICT/NO ACTION preservam histórico.

Snapshots JSON guardam metadata/árvore/controle/peso/caminho e metadados do arquivo
privado; resultado de meta JSON inclui fontes/instante. Índice é derivado dos
resultados históricos e pesos copiados, nunca da definição atual. JSON null é
interpretado como null no adapter; SQL CHECK aceita também SQL NULL onde aplicável.

SQL adicional ao Prisma: CHECKs de enums, versão positiva, posição/peso, score/status,
N/A justificado, fechamento/completedAt e formas exclusivas de evidência/escopo de
meta. Ciclos/profundidade, limites, URL, visibilidade/grants e transições são validados
na aplicação, sob lock do Workspace. Grants de sistema ampliados; customizados
preservados. [Decisões](GOVERNANCE_IMPLEMENTATION_DECISIONS.md) e [contratos](../front-specs/governance-contracts.md).

## Índices de visão geral — 04/10/2026

Migration `202610040007_dashboard_indexes`, equivalente MySQL/MariaDB,
acrescenta índices `(workspace_id,project_id,created_at)` em test_runs/defects
e `(workspace_id,project_id,executed_at,test_case_id,result)` em test_run_cases.
Sem novas entidades/colunas, alterações de registros ou recálculo. Projeções
em SQL agrupam todas as fontes autorizadas antes das listas resumidas.

## Metas por seção e ambientes em defeitos — 04/10/2026

`202610040008_framework_progress_goals` adiciona section_id e owner_member_id nulos em governance_goals, índices e FKs compostas para FrameworkSection (Workspace/framework) e WorkspaceMember (Workspace). CHECK limita seção ao escopo GOVERNANCE_SCORE sem projeto. Resultados guardam section/name/path e reason opcionais em JSON; histórico anterior permanece.

`202610040009_defect_environments` adiciona category em environments (OTHER por padrão), environment_id e environment_snapshot nulos em defects, FK composta por Workspace/projeto e índice por ambiente/data. Snapshot guarda nome/categoria na associação; cadastro não reescreve defeitos. As duas histórias preservam dados e migrations anteriores.

## Extensões autorizadas de 06/10/2026

GovernanceControl.creationOrder INT auto increment único e índice por
Workspace/framework/creationOrder. TestCaseImport guarda recibo JSON/SHA-256 único
por Workspace/projeto. TestVaultEntry guarda encrypted_payload LONGTEXT, key_id,
metadados/version e ambiente opcional, com FKs compostas. Não contém username,
password, url ou notes em colunas de texto puro. [Migration/decisões](PRODUCT_IMPROVEMENTS_20261006.md).
DATETIME(3) continua UTC; apenas apresentação HTTP muda para -03:00.
