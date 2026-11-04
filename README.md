# Lambda Quality API

Backend da plataforma Lambda Quality para gestão de testes, execuções,
rastreabilidade e governança de qualidade, com isolamento por Workspace.

Projeto open source da **Lambda Team**, distribuído sob a [licença MIT](LICENSE).
A identidade e os identificadores técnicos foram atualizados em 04/11/2026
para uma instalação nova, sem migração de dados de versões anteriores.
Veja as [decisões e impactos de compatibilidade](codex/PRODUCT_IDENTITY.md).

## Estado do projeto

Bootstrap e identidade implementados: cadastro confirmado por código de
e-mail, login, refresh/logout, recuperação de senha via SendGrid e Swagger.
Fase 01 de Workspace implementada: membros, convites por e-mail, ownership,
roles/grupos e permissões, campos personalizados, tags e anexos privados.
Fase 02 de Projetos implementada: acesso por participante, marcos e ambientes.
Fase 03 de Casos de Teste implementada: suítes hierárquicas, casos/passos,
clonagem, archive/restore, sequência e vínculos/valores de catálogos.
Fase 04 de Planos e Execuções implementada: seleção ordenada, execução manual,
resultados por caso/passo, comentários e snapshots. Fase 05 de Defeitos implementada: estados, referências externas e anexos.
Fase 06 de Governança implementada: frameworks, avaliações históricas,
evidências privadas, metas, ações e dashboard interno. Requisitos e integrações
permanecem no backlog.

## Direção técnica

- TypeScript com modo `strict` e Node.js **24.x**.
- MariaDB **10.11** como banco deste ambiente; MySQL **8.4** continua com
  histórico próprio para instalações existentes.
- Monólito modular; NestJS e Prisma como baseline técnica desta revisão.
- Access token JWT enviado como `Authorization: Bearer <accessToken>`.
- Refresh token opaco, com expiração, rotação e revogação de sessão.
- Respostas JSON padronizadas e erros em Problem Details, com mensagens
  legíveis em português e códigos estáveis para os consumidores.

Os detalhes, exemplos e critérios de aceite estão no
[índice de especificações](codex/README.md). O
[plano de implementação](codex/CODEX_IMPLEMENTATION_PLAN.md) define as fases.

A sequência revisada é Workspaces, Projetos, Casos de Teste, Planos e
Execuções, Defeitos e Governança. A fase única de Workspaces está detalhada
no [planejamento do módulo](codex/WORKSPACE_DEVELOPMENT_PLAN.md), incluindo
membros, convites, roles, grupos, campos personalizados, tags e anexos.
Shared parameters e Shared steps foram excluídos do escopo.

As [instruções para o front-end](front-specs/README.md) serão atualizadas
a cada criação ou mudança de endpoint, junto à implementação e ao OpenAPI.

## Orientações para contribuir

Leia [AGENTS.md](AGENTS.md) e os documentos de `codex/` antes de alterar o
projeto. Preserve o isolamento entre tenants e os snapshots históricos.
Mudanças de contrato, stack ou modelo precisam ser documentadas.

## Executar localmente

Para homologação em Docker, consulte [CI/CD e provisionamento](codex/CICD_HML.md).
A pipeline `azure_devops_hml.yml` valida antes de publicar na VM registrada em
Azure Environments, aplica migrations e oferece rollback manual da aplicação.

Requisitos: Node.js 24.x, MariaDB 10.11 e remetente verificado no SendGrid.
Configure `DATABASE_DIALECT=mariadb` no `.env`; MySQL 8 usa `mysql`.
O protocolo de `DB_URL` / `DATABASE_URL` permanece `mysql://`, inclusive no MariaDB.
Configure `.env` a partir de [.env.example](.env.example); senhas com `#`
precisam de aspas. DB_URL aceita o formato JDBC já informado, com DB_USERNAME
e DB_PASSWORD; DATABASE_URL também é aceito. O .env não é versionado.

```powershell
npm ci
npm run setup:keys
npm run migration:deploy
npm run build
npm start
```

As migrations MariaDB estão em `prisma/migrations-mariadb/`; a configuração
Prisma seleciona esse histórico por `DATABASE_DIALECT`. O padrão ausente é `mysql`
para preservar instalações anteriores. Não troque o dialeto de um banco já
inicializado; as duas sequências têm checksums diferentes. O histórico MySQL
original não foi reescrito. Veja [decisão de compatibilidade](codex/MARIADB_COMPATIBILITY.md).

`setup:keys` cria chaves RS256 locais ignoradas pelo Git e preserva chaves
existentes. Em produção, configurar chaves externas e NODE_ENV=production.
O JWT_SECRET existente é usado como segredo HMAC dos códigos de e-mail;
JWT de acesso é assinado com RSA. OTP_HMAC_SECRET permite segredo separado.

Swagger: [http://localhost:3000/docs](http://localhost:3000/docs).
OpenAPI: [http://localhost:3000/docs-json](http://localhost:3000/docs-json).
API base: `http://localhost:3000/api/v1`. HOST/PORT são configuráveis.
Swagger fica desabilitado por padrão em produção; SWAGGER_ENABLED controla isso.

Para testar: solicitar código em `/auth/registration/code`, confirmar em
`/auth/register`, realizar `/auth/login` e colar somente o accessToken no
botão **Authorize** do Swagger. Testar `/auth/me` e logout. Recuperação usa
`/auth/password-reset/code` e `/auth/password-reset`; sucesso exige novo login.

SendGrid usa SENDGRID_API_KEY e SENDGRID_FROM_EMAIL, com MAIL_USERNAME como
fallback de remetente. MAIL_HOST/PORT/PASSWORD não são usados pelo adapter
da API SendGrid. A API não retorna códigos de confirmação: consulte o e-mail.

## Workspace e integração do front-end

Após login, `GET /api/v1/workspaces` lista os Workspaces acessíveis;
`POST /api/v1/workspaces` cria um Workspace com o usuário autenticado como Owner.
São 48 endpoints nesta fase, descritos nos [guias do front-end](front-specs/README.md)
e no Swagger. As decisões estão em
[WORKSPACE_IMPLEMENTATION_DECISIONS.md](codex/WORKSPACE_IMPLEMENTATION_DECISIONS.md).

Convites usam SendGrid e token opaco de uso único, com validade padrão de
48 horas. `INVITATION_ACCEPT_URL` configura a página do front-end que recebe
o token no fragmento `#token=...`; sem essa configuração, o e-mail contém o
token para aceite manual no Swagger. O aceite exige login com o e-mail
verificado correspondente. `deliveryStatus: SENT` significa aceitação pelo
provedor, sem confirmar recebimento na caixa postal. Falhas são recuperadas
por worker a cada 30 segundos, até cinco tentativas; reenvio manual gera novo token.
`INVITATION_ENCRYPTION_SECRET` deve ser persistente entre reinícios/réplicas
para recuperar a intenção de envio cifrada; consulte `.env.example`.

Anexos e evidências usam **Oracle OCI Object Storage**, com bucket privado,
sem gravação no disco do servidor e sem fallback local. A API recebe multipart
em memória e transmite o download após conferir acesso ao Workspace. O banco
guarda metadados, checksum e vínculos. PNG/JPEG/PDF/TXT/CSV, até 10 MiB por padrão.
Configure as variáveis `LAMBDAQUALITY_STORAGE_*` de [.env.example](.env.example),
incluindo uma chave RSA da OCI cujo fingerprint corresponda ao informado.
Falhas de configuração/PEM/acesso OCI não impedem a API de iniciar: o upload retorna
`503 ATTACHMENT_STORAGE_UNAVAILABLE` com mensagem para o usuário. Login e demais
módulos continuam disponíveis; chaves JWT e banco permanecem obrigatórios.
No Docker, monte a chave como secret somente leitura; ela não deve entrar na imagem.
`npm run attachments:check-oci` verifica bucket privado e upload/download/remoção.
Antes de iniciar esta versão com anexos antigos, pare uploads na versão anterior,
execute `npm run attachments:migrate-to-oci` (simulação) e depois
`npm run attachments:migrate-to-oci -- --apply`. A migração confere checksum,
preserva arquivos locais/metadados e pode ser retomada sem sobrescrever objetos.
`ATTACHMENT_STORAGE_PATH` é usado somente para localizar esses arquivos antigos.
`npm run attachments:cleanup` remove objetos excluídos há 30 dias e órfãos de
mais de 24 horas, apenas no prefixo da aplicação; agende no ambiente de operação.
Consulte [configuração, migração e Docker](codex/OCI_STORAGE_IMPLEMENTATION_DECISIONS.md)
e o [contrato para o front](front-specs/workspace-attachments.md).

## Verificação

Projetos: [guia do front-end](front-specs/projects.md),
[matriz de acesso](front-specs/project-contracts.md) e
[decisões técnicas](codex/PROJECT_IMPLEMENTATION_DECISIONS.md).
Key única por Workspace e imutável; arquivamento preserva os filhos.
A Fase 02 adicionou 19 endpoints; com as contagens do repositório, visão geral, acompanhamento de frameworks e indicadores de defeitos, são 179 operações no Swagger após as evoluções de 06/10/2026.

```powershell
npm run db:check
npm run typecheck
npm run lint
npm test
npm run test:integration
```

`test:integration` usa Testcontainers com Docker/MySQL 8.4.11. Sem Docker,
`npm run test:integration:local` usa o servidor MySQL em loopback do .env,
criando e removendo **somente um banco temporário próprio**. O usuário precisa
de permissões para criar/remover esse banco; dados do banco configurado não
são utilizados nos testes. TEST_MYSQL_SERVER_URL permite servidor dedicado.

Verificações históricas da Fase 02: build, tipos, lint, 29 testes unitários/HTTP e
24 de integração MySQL. Para a entrega atual, veja a Fase 05 abaixo. Integração cobre banco vazio e upgrade com grants
existentes, concorrência, revogação e isolamento por Workspace/Project.
Testes automatizados mockam o envio de e-mail;
não enviam mensagens reais. Consulte os [guias do front-end](front-specs/README.md)
para os payloads, erros e fluxos completos.

## Casos de Teste — Fase 03

26 endpoints de suítes/casos/passos, vínculos e contagens diretas do repositório, em [test-cases.md](front-specs/test-cases.md).
[Contratos e integração](front-specs/test-case-contracts.md) documentam version,
campos obrigatórios, clone, ordenação e autorização. Na entrega da Fase 03 eram 103 operações na API.
Aplicar a migration aditiva `202610020003_test_management` antes de iniciar
a nova versão. Na Fase 03 o catálogo tinha 24 permissions; roles customizadas precisam de
grants explícitos de testcase. Nenhum dado da base configurada neste computador
foi migrado automaticamente: a validação usa schemas/containers descartáveis.

## Planos e Execuções — Fase 04

24 endpoints em [execution.md](front-specs/execution.md), com
[contratos e fluxo manual](front-specs/execution-contracts.md). Planos DRAFT
permitem metadados/seleção; ACTIVE permite criar Runs com definições atuais.
Run avulso ou de plano preserva casos, passos, tags, campos personalizados e
contexto como snapshots; resultados e comentários exigem IN_PROGRESS.
Plan/Run usam version e auditoria. COMPLETED/ABORTED ficam imutáveis.

Aplicar a migration aditiva `202610020004_execution` antes de iniciar a versão.
Na Fase 04 o catálogo tinha 27 permissions; roles customizadas precisam de grants
explícitos de testrun. A base configurada não foi migrada automaticamente;
validações usam bancos descartáveis. Consulte as
[decisões e verificação](codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

Verificados nesta entrega: lint, tipos e build; 83 testes aprovados, sendo 37
unitários/HTTP e 46 com MySQL 8.4.11 real. Snapshots, concorrência, isolamento
e upgrade da Fase 03 cobertos. Documentação e OpenAPI consistentes.

## Defeitos — Fase 05

10 endpoints em [defects.md](front-specs/defects.md), com
[contratos e fluxo](front-specs/defect-contracts.md). Defeitos avulsos ou
vinculados a FAILED, sequência por projeto, estados auditados, controle de
version, referências externas e anexos da biblioteca privada. Criar defeito
não altera snapshots/resultados da execução. Catálogo atual: 35 permissions;
roles customizadas precisam de grants explícitos de defect.read/manage.

Aplicar `202610020005_defects` antes da nova versão. Base configurada não foi
migrada automaticamente; validação usa bancos descartáveis. Referência externa
não faz sincronização nem chamadas a Azure DevOps/Jira. Ver
[decisões e verificação](codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

Verificados na Fase 05: lint, tipos e build; 96 testes aprovados (39 unitários/HTTP,
57 com MySQL 8.4.11 real), incluindo banco vazio/upgrade da Fase 04, concorrência,
isolamento de referências, autorização de anexos e preservação de snapshots.
OpenAPI e guias front-end consistentes; nenhuma migration aplicada à base configurada.

## Governança — Fase 06

Governança: [33 endpoints](front-specs/governance.md),
[contratos de integração](front-specs/governance-contracts.md) e
[decisões da Fase 06](codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md).

Frameworks/seções/controles, avaliações com snapshots e fechamento imutável,
evidências privadas/URLs, metas calculadas, ações e dashboard INTERNAL.
Metas disponíveis: automação, defeitos críticos e índice interno de avaliação;
requisitos/flaky permanecem pendentes. N/A exige justificativa; o índice não
representa certificação oficial. Catálogo atual: 35 permissions.

Migration `202610030006_governance` criada, sem aplicar ao banco configurado.
Verificados: lint, tipos, build e 110 testes (43 unitários/HTTP, 67 MySQL real),
com upgrade da Fase 05 e isolamento entre tenants. OpenAPI original da Fase 06:
168 operações; são 169 com a rota de contagens adicionada em 03/10/2026.

## Verificação no MariaDB

`npm run test:integration` usa a imagem fixada do dialeto selecionado
(`mariadb:10.11.14` ou `mysql:8.4.11`). A suíte verifica banco vazio, upgrade de
cada fase, JSON, constraints, isolamento, concorrência e HTTP, com e-mails
simulados. Para testar em um servidor dedicado, configure `TEST_DATABASE_SERVER_URL`
e `TEST_DATABASE_DIALECT=mariadb`. O alias anterior `TEST_MYSQL_SERVER_URL` permanece
aceito. Schemas de teste usam somente `lambdaquality_test_*` e são removidos no fim;
o banco de aplicação nunca é usado como schema de teste. A credencial de integração
precisa criar/remover esses schemas. `test:integration:local` aceita a configuração
local apenas em loopback; servidores remotos precisam da URL de teste explícita.

## Visão geral do produto — 04/10/2026

GET `/api/v1/dashboard/overview`, com days=7/30/90 (padrão 30) e workspaceId
opcional. Grants e acesso atuais de cada fonte, projetos/Workspaces ativos,
contagens completas, resultados, cobertura de execução e listas resumidas.
Histórico de catálogo/cobertura indisponível retorna null. Metas não são
recalculadas pelo Início. [Contrato do front](front-specs/dashboard.md).

Aplicar a migration aditiva `202610040007_dashboard_indexes` usando o
DATABASE_DIALECT do banco existente, com `npm run migration:deploy`.
Depois, rebuild/reiniciar a API e recarregar o front. Os históricos MySQL e
MariaDB incluem índices equivalentes; sem novos grants ou cálculos persistidos.

## Extensões de 04/10/2026

- [Progresso de frameworks e metas por seção](front-specs/framework-progress.md): leitura com snapshots e bloco frameworkGovernance na overview.
- [Ambientes e gráficos de bugs](front-specs/defect-analytics.md): cadastro de ambientes para o front, associação no defeito e agregações por mês/projeto/categoria.
- Migrations aditivas `202610040008_framework_progress_goals` e `202610040009_defect_environments` nas duas histórias. Aplicar com `npm run migration:deploy` antes de reiniciar a API; não usar reset/db push.

### Evoluções do produto — 06/10/2026

Inventário de defeitos entre Workspaces autorizados, importação CSV Azure DevOps,
cofre AES-256-GCM por projeto, ordem técnica de criação dos controles e timestamps
HTTP -03:00. [Entrega/operação](codex/PRODUCT_IMPROVEMENTS_20261006.md) e
[instruções do front](front-specs/product-improvements.md). Aplicar migration
202610060001_product_improvements; configurar as chaves externas do cofre para
escrita/revelação. Dados temporais no banco continuam UTC.
