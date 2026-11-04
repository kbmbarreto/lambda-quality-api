# Plano de implementação do Codex

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](MARIADB_COMPATIBILITY.md).

## Estado atual e sequência acordada — 02/10/2026

Bootstrap, Swagger e identidade já foram entregues: cadastro por código de
e-mail, login, refresh/logout e recuperação de senha via SendGrid. Essa base
fica fora da numeração das próximas fases e não deve ser recriada.

O usuário definiu a sequência abaixo, substituindo a numeração anterior:

| Fase | Módulo             | Escopo principal                                                                               |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------- |
| 01   | Workspaces         | Workspace, membros, convites, roles, permissions, grupos, campos personalizados, tags e anexos |
| 02   | Projetos           | Project, acesso por projeto, Milestone e Environment                                           |
| 03   | Casos de Teste     | TestSuite, TestCase, TestStep e uso de campos/tags/anexos                                      |
| 04   | Planos e Execuções | TestPlan, TestRun, resultados e snapshots                                                      |
| 05   | Defeitos           | Defect e vínculo com falha/anexos                                                              |
| 06   | Governança         | Frameworks, avaliações, evidências, metas e planos de ação                                     |

Workspaces é uma **fase única**, sem separar membros/convites de
roles/grupos em entregas diferentes. Fields, Tags e Attachments também
entram na administração do Workspace; o uso em outros módulos acompanha
suas fases. Shared parameters e Shared steps foram **excluídos do escopo**,
por solicitação explícita; TestStep próprio de cada caso continua previsto.

O [plano detalhado de Workspaces](WORKSPACE_DEVELOPMENT_PLAN.md) define a
entrega única e as decisões consolidadas nas migrations. A Fase 01 foi
implementada; Fase 02 também entregue. Fases 03–06 também entregues, incluindo Governança em 03/10/2026. Requisitos e
integrações continuam no backlog, sem posição definida nesta sequência.

## Instruções gerais

Implemente incrementalmente. Não avance com build ou testes quebrados.
Não invente entidades/regras para contornar a especificação. Se houver
ambiguidade estrutural, documente a decisão antes da parte afetada.

Em cada fase de negócio: migration; domínio; repositories/ports; use cases;
API/DTOs; validação/autorização; testes unitários e integração; OpenAPI;
instruções de integração em `front-specs/` para cada endpoint entregue;
verificações de tipos, lint e build. Bootstrap adapta essa sequência sem
antecipar módulos de negócio.

## Base entregue — Bootstrap e identidade

- TypeScript `strict`, Node.js 24.x, ESM, NestJS e Prisma/MySQL 8.4 LTS.
- npm/lockfile, configuração validada, migrations versionadas, logs sem
  segredos, envelopes/Problem Details e requestId.
- Health, Swagger, Vitest/Supertest e integração MySQL.
- User, EmailChallenge, AuthSession e RefreshToken; cadastro e recuperação
  por código via SendGrid, Argon2id, JWT bearer e refresh opaco rotativo.
- Login, refresh, logout, logout-all e me; rate limit, expiração,
  detecção de reuso e revogação persistida; User/sessão ativos por request.
- Guias de identidade/saúde em `front-specs/`.

Preservar os contratos, testes e garantias dessa base em todas as fases.
Cadastro continua criando identidade global, sem Workspace automático.

## Fase 01 — Workspaces

Entregar todo o [plano de Workspaces](WORKSPACE_DEVELOPMENT_PLAN.md) na
mesma fase, com revisão ao final. Ordem interna de construção não cria
entregas separadas nem autoriza encerrar com somente parte do escopo.

- Workspace, WorkspaceMember, Invitation, ownership e contexto de tenant.
- Convites via SendGrid: criar, listar, reenviar, cancelar e aceitar.
- Role, Permission, Group, RolePermission, MemberRole, GroupMember e GroupRole.
  CRUD de roles customizadas e grupos; concessões diretas/herdadas atuais.
- Catálogo de campos personalizados: definições, tipos, opções e arquivamento.
  Consolidar o novo modelo técnico antes da migration correspondente.
- Catálogo de tags do Workspace, preservando o módulo testmanagement.
- Biblioteca de anexos: storage abstraction, upload, metadados, download
  autorizado e exclusão lógica, preservando o módulo attachment.
- Auditoria transacional das operações administrativas e acesso a arquivos.
- Busca, filtros, paginação; Swagger e guias front-end de todo o escopo.

Campos/tags/anexos são administrados nesta fase. Valores e vínculos com
Project/TestCase/Run/Defect/Governance entram junto a cada consumidor,
com suas constraints tenant/project e sem rotas para recursos inexistentes.

**Aceite:** todos os itens entregues; dois tenants isolados; membership e
permissions atuais por request; revogação na próxima requisição após commit;
convites sem duplicação e com falhas/retries cobertos; Owner protegido sob
concorrência; prevenção de escalada; catálogos e arquivos autorizados; MySQL
real, migrations, Swagger/front-specs e verificações da fase completos.

## Fase 02 — Projetos

Project, ProjectMember, Milestone e Environment; CRUD e arquivamento.
Implementados; [decisões](PROJECT_IMPLEMENTATION_DECISIONS.md),
[contratos front-end](../front-specs/projects.md) e OpenAPI descrevem a entrega.
Evoluir o escopo de catálogos/arquivos quando necessário, sem quebrar o
catálogo global ao Workspace entregue na fase anterior.

**Aceite:** key única por Workspace; acesso por membership e escopo de
projeto; referências não cruzam tenants; arquivamento preserva histórico.

## Fase 03 — Casos de Teste

Implementada; [decisões](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md) e
[contratos front-end](../front-specs/test-cases.md) descrevem a entrega.

TestSuite, TestCase e TestStep; árvore recursiva, ordenação, clone/archive,
sequence transacional e detecção de ciclos. Associar tags, anexos e valores
de campos personalizados usando os catálogos da Fase 01.

Não incluir Shared steps ou Shared parameters. TestStep continua sendo o
passo próprio de um TestCase. Modelar/validar valores personalizados conforme
tipo, alvo e obrigatoriedade antes de persistir.

**Aceite:** suíte não entra em descendente; case e vínculos não cruzam
Project/Workspace; sequence única sob concorrência; histórico preservado.

## Fase 04 — Planos e Execuções

TestPlan/TestPlanCase e TestRun/TestRunCase/TestRunStep na mesma fase.
Seleção/ordenação de casos, runs com ou sem plano, execução manual,
resultados e snapshots, incluindo valores personalizados aplicáveis.

**Aceite crítico:** somente casos do mesmo Project/Workspace; criar Run,
alterar TestCase, TestStep e campos originais e comprovar que snapshots
da execução permanecem iguais. Auditoria acompanha alterações de execução.

## Fase 05 — Defeitos

Implementada; [decisões](DEFECT_IMPLEMENTATION_DECISIONS.md) e
[contratos front-end](../front-specs/defects.md) descrevem a entrega.

Defect, vínculo opcional com falha de TestRunCase, referência externa e
anexos. Integrar à biblioteca existente sem acoplar domínio a SDK externo.

**Aceite:** vínculo com execução/projeto no mesmo tenant; sequence segura;
alterações de estado auditadas; acesso aos anexos preserva autorização.

## Fase 06 — Governança (entregue em 03/10/2026)

GovernanceFramework, FrameworkSection, GovernanceControl, Assessment,
ControlAssessment, EvidenceLink, GovernanceGoal e ActionPlan. Evidências
usam a biblioteca de anexos quando aplicável; metas dependentes de features
ainda ausentes não são apresentadas como disponíveis.

[Decisões adotadas](GOVERNANCE_IMPLEMENTATION_DECISIONS.md), [contratos](../front-specs/governance-contracts.md) e [32 endpoints](../front-specs/governance.md).

**Aceite:** avaliações históricas independentes; seções sem ciclos; N/A
exige justificativa; avaliações fechadas preservadas; cálculo interno não
é rotulado como certificação oficial; evidências autorizadas por tenant.

## Backlog sem fase definida na sequência atual

- **Requisitos/rastreabilidade:** Requirement, RequirementTestCase e matriz
  de rastreabilidade. Permanecem documentados; não antecipar na Fase 03.
- **API de automação:** credenciais de integração, importação idempotente,
  source/externalRunRef e mapeamento de resultados. Retry não duplica Run;
  payload diferente com a mesma chave conflita; credencial não cruza tenant.
- **Integrações:** adapters Azure DevOps/Jenkins e formatos de resultado,
  sem SDKs no domínio.
- **Evoluções:** consultas gerais de auditoria, dashboards e recursos SaaS
  da visão conceitual, quando solicitados e especificados.

Shared parameters e Shared steps não fazem parte desse backlog: estão
excluídos por decisão do usuário em 02/10/2026.

## Definition of Done por fase

Scripts e verificações disponíveis na base, exigidos por fase de implementação:

- `npm ci` reproduzível com lockfile em CI.
- `npm run lint`, `npm run typecheck` e `npm run build` passam.
- `npm test` passa; `npm run test:integration` passa com MySQL/Testcontainers.
- `npm run migration:generate` para gerar/revisar localmente e
  `npm run migration:deploy` para aplicar migrations versionadas; os
  comandos internos seguem a versão Prisma selecionada.
- Migrations reproduzíveis em banco vazio e upgrade da fase anterior.
- OpenAPI e documentação atualizados; respostas seguem o contrato.
- Cada endpoint criado, alterado, descontinuado ou removido possui instruções
  atualizadas em `front-specs/`, conforme seu README e modelo; índice,
  exemplos e impactos de compatibilidade acompanham a entrega.
- Testes cross-tenant/autorização para recursos implementados.
- Sem secrets em logs; sem dependências cíclicas entre módulos.
- Relatar resultados e limitações reais; não afirmar verificação não executada.

Itens futuros não são implementados para satisfazer o aceite de uma fase
anterior. Deploy/publicação não integra automaticamente o aceite local.

## Entrega atual — resultados

- Bootstrap e endpoints de identidade/saúde implementados; Swagger em
  `/docs` e OpenAPI JSON em `/docs-json`.
- Migrations de identidade, Workspace e Projetos aplicadas em MySQL 8.4.11,
  com conferência da preservação das contagens anteriores e grants existentes.
  Integração usa schema
  temporário exclusivo, removido ao finalizar. Testcontainers é a alternativa
  padrão para ambientes com Docker.
- Verificações: build, tipos, lint, 29 testes unitários/HTTP e 24 testes
  MySQL de integração aprovados. Envio SendGrid verificado com mock, sem
  enviar códigos a destinatários reais durante os testes automatizados.
- Fase 01 implementada com 48 endpoints: Workspace/membros/convites, ownership,
  RBAC/grupos, campos, tags e anexos. Testes verificam isolamento de leituras,
  buscas, downloads e escritas; FKs compostas impedem relações entre tenants;
  revogação, escalada de privilégio e concorrência foram verificadas.
  Documentação em [front-specs](../front-specs/README.md) e snapshot OpenAPI.
- Storage local privado exige volume persistente/compartilhado quando aplicável;
  limpeza física executada por rotina explícita. Testes não comprovam entrega
  real de SendGrid em caixa postal. Valores de campos/vínculos acompanham os
  consumidores nas fases futuras; na entrega da Fase 01, Fases 04–06 não foram antecipadas.
- Fase 02: 19 endpoints de projetos/participantes/marcos/ambientes, com acesso
  local, atualizações de permissões de sistema e preservação de grants customizados.
  Integração verifica banco vazio e upgrade da Fase 01, key única sob concorrência,
  escopo de filhos, revogação, não recuperação de grants na reentrada, arquivos
  e catálogos existentes preservados. Conclusão/arquivamento idempotentes.
- Fase 03: 25 endpoints de suítes/casos/passos, tags/anexos e valores;
  migrations aditivas, quatro permissions e concorrência por version.
  Lint/tipos/build e 68 testes aprovados (33 unitários/HTTP, 35 MySQL).
  Banco vazio e upgrade da Fase 02 preservam dados/grants. OpenAPI tem
  103 operações; front-specs registra contratos e impactos de compatibilidade.
  [Resultados e limitações](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md#verificação-da-entrega).

- Fase 04: 24 endpoints de planos/execuções, três permissions, controle de
  version e snapshots imutáveis de definição, passos, campos, tags e contexto.
  Execução manual e comentários com autorização atual e FKs compostas.
  Lint/tipos/build e 83 testes aprovados (37 unitários/HTTP, 46 MySQL).
  Banco vazio e upgrade da Fase 03 preservam dados/grants; snapshots permanecem iguais.
  OpenAPI tem 127 operações; front-specs inclui os impactos nos grants existentes.
  [Decisões e resultados](EXECUTION_IMPLEMENTATION_DECISIONS.md).

- Fase 05: 9 endpoints de defeitos, duas permissions, sequence DEFECT independente,
  version, estados auditados, origem FAILED no mesmo escopo, referência externa
  manual e vínculos tipados com anexos privados. Lint/tipos/build e 96 testes
  aprovados (39 unitários/HTTP, 57 MySQL), incluindo banco vazio/upgrade da Fase 04.
  OpenAPI: 136 operações.
  [Resultados e limitações](DEFECT_IMPLEMENTATION_DECISIONS.md).

- Fase 06: 32 endpoints de Governança, três permissions, frameworks/seções/
  controles, snapshots de avaliações, N/A justificado, fechamento imutável,
  evidências privadas, metas por Strategies disponíveis, ações e dashboard
  INTERNAL. Lint/tipos/build e 110 testes aprovados (43 unitários/HTTP, 67 MySQL).
  Banco vazio e upgrade da Fase 05 preservam históricos/grants; OpenAPI tem
  168 operações. [Resultados e limites](GOVERNANCE_IMPLEMENTATION_DECISIONS.md).
