# Especificação da API — v1

Base: `/api/v1`. JSON UTF-8. Campos e códigos em inglês; mensagens legíveis
em **pt-BR**. Datas/horas ISO 8601 com offset `-03:00` nas respostas (persistência UTC); datas de calendário em
`YYYY-MM-DD`. DTOs públicos não expõem registros de persistência diretamente.

## Contrato de sucesso

Content-Type `application/json`. Respostas 200/201/202 usam `data`, `message`
e `meta`. `message` descreve o resultado e não serve como código de controle.
`meta.requestId` coincide com o header `X-Request-Id` e a correlação dos logs;
`meta.timestamp` indica o instante da resposta. O servidor gera requestId
ou valida estritamente um valor recebido antes de propagá-lo.

Exemplo de criação (`201`, com header `Location` do recurso criado):

```json
{
  "data": {
    "id": "b4bfc371-5831-4e2e-97ab-08e05b3e25dd",
    "name": "Portal Cliente",
    "key": "PORTAL",
    "status": "ACTIVE"
  },
  "message": "Projeto criado com sucesso.",
  "meta": {
    "requestId": "6d738190-4a53-4b5b-9e92-7b6206f49923",
    "timestamp": "2026-09-30T13:00:00.000Z"
  }
}
```

Listagens usam `data` como array e `meta.pagination`:

```json
{
  "data": [],
  "message": "Projetos consultados com sucesso.",
  "meta": {
    "requestId": "6d738190-4a53-4b5b-9e92-7b6206f49923",
    "timestamp": "2026-09-30T13:00:00.000Z",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 0,
      "totalPages": 0,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

`204` não tem corpo nem envelope; requestId continua no header. Este padrão
vale para APIs JSON; download/stream de anexos preserva o Content-Type do
arquivo e não recebe envelope. Erros desses endpoints seguem Problem Details
quando ainda for possível enviar uma resposta HTTP.

## Erros legíveis — Problem Details

Erros usam `application/problem+json`, conforme
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), sem envelope de sucesso.
Campos obrigatórios neste projeto: `type`, `title`, `status`, `detail`,
`instance`, `code`, `requestId` e `timestamp`. `errors` é opcional e contém
erros por campo. `instance` é o caminho da requisição, sem query ou segredos.
`type` usa URN estável por tipo de problema.

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os campos informados e tente novamente.",
  "instance": "/api/v1/auth/login",
  "code": "VALIDATION_ERROR",
  "requestId": "6d738190-4a53-4b5b-9e92-7b6206f49923",
  "timestamp": "2026-09-30T13:00:00.000Z",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_EMAIL",
      "message": "Informe um endereço de e-mail válido."
    }
  ]
}
```

`field` identifica o caminho no payload/query, incluindo índices quando
necessário. Não retornar valores secretos rejeitados, SQL, stack traces,
nomes internos de tabelas ou mensagens brutas do ORM/framework. Falhas
inesperadas retornam `500 INTERNAL_ERROR`, com mensagem genérica e requestId
para investigação. Não retornar HTTP 200 para representar erro.

| HTTP | Código estável             | Mensagem/uso                                  |
| ---- | -------------------------- | --------------------------------------------- |
| 400  | VALIDATION_ERROR           | Campos, tipos, JSON ou parâmetros inválidos   |
| 401  | AUTH_UNAUTHENTICATED       | Autenticação necessária                       |
| 401  | AUTH_INVALID_CREDENTIALS   | E-mail ou senha inválidos                     |
| 401  | AUTH_INVALID_ACCESS_TOKEN  | Token de acesso inválido                      |
| 401  | AUTH_ACCESS_TOKEN_EXPIRED  | Token de acesso expirado                      |
| 401  | AUTH_SESSION_REVOKED       | Sessão revogada; novo login necessário        |
| 401  | AUTH_SESSION_EXPIRED       | Sessão expirada; novo login necessário        |
| 401  | AUTH_INVALID_REFRESH_TOKEN | Token de renovação inválido                   |
| 401  | AUTH_REFRESH_TOKEN_EXPIRED | Token de renovação expirado                   |
| 401  | AUTH_REFRESH_TOKEN_REUSED  | Renovação reutilizada; sessão revogada        |
| 403  | AUTH_FORBIDDEN             | Sem permissão no escopo visível               |
| 404  | RESOURCE_NOT_FOUND         | Recurso não encontrado                        |
| 409  | RESOURCE_CONFLICT          | Duplicidade, versão concorrente ou invariante |
| 429  | RATE_LIMIT_EXCEEDED        | Muitas tentativas; retornar Retry-After       |
| 500  | INTERNAL_ERROR             | Não foi possível concluir a solicitação       |
| 503  | SERVICE_UNAVAILABLE        | Dependência necessária indisponível           |

401 em rotas protegidas por bearer inclui `WWW-Authenticate: Bearer`;
token inválido/expirado pode incluir `error="invalid_token"`. Login e refresh
não exigem bearer. Fora do escopo visível, sempre 404 genérico; 403 somente
para permissão insuficiente dentro do escopo visível.

## Paginação, filtros e validação

- Query `page` inicia em **1**, padrão 1; `size` padrão 20 e máximo 100.
- `sort` usa `campo,asc` ou `campo,desc`; allowlist por endpoint e desempate
  por ID. Valor desconhecido/inválido resulta em 400.
- Filtros somente pelos campos documentados; rejeitar parâmetros inesperados.
- Listagem vazia retorna 200 com array vazio, não 404. Página além do total
  retorna array vazio e os totais reais; `hasPrevious` vale se `page > 1`
  e `totalItems > 0`; `hasNext` vale se `page < totalPages`.
- Validar UUIDs, enums, tamanhos, intervalos, body e query em runtime.
  Campos extras no body são rejeitados; `PATCH` diferencia ausente de nulo.
- Campos opcionais nulos seguem schema OpenAPI; não variar formato por acaso.

## Autenticação

```text
POST /auth/registration/code — público; solicitar código de cadastro; 202
POST /auth/register          — público; código, nome e senha; 201
POST /auth/password-reset/code — público; solicitar código de recuperação; 202
POST /auth/password-reset    — público; código e nova senha; 204
POST /auth/login       — público; e-mail e senha
POST /auth/refresh     — público para bearer; exige refresh token válido
POST /auth/logout      — bearer; revoga a sessão atual; 204
POST /auth/logout-all  — bearer; revoga todas as sessões do usuário; 204
GET  /auth/me          — bearer; identidade pública do usuário; 200
```

Todos os caminhos acima são relativos a `/api/v1`. Login não recebe
Workspace; autentica a identidade global. Membership é verificado ao
acessar rotas de Workspace. Logout usa `sid` validado do access token,
sem escolher sessão/usuário pelo body. `/auth/me` nunca retorna hash de senha.

Body de login:

```json
{
  "email": "usuario@example.com",
  "password": "<senha-do-usuario>"
}
```

Login e refresh retornam 200 com o mesmo formato de tokens abaixo.
`expiresIn` é a duração restante do access token em segundos;
`refreshExpiresIn` é a duração restante do refresh token em segundos.
Os valores ilustram a configuração padrão e variam perto do limite da sessão.

```json
{
  "data": {
    "accessToken": "<jwt-de-acesso>",
    "refreshToken": "<token-opaco-de-renovacao>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "refreshExpiresIn": 86400
  },
  "message": "Autenticação realizada com sucesso.",
  "meta": {
    "requestId": "6d738190-4a53-4b5b-9e92-7b6206f49923",
    "timestamp": "2026-09-30T13:00:00.000Z"
  }
}
```

Body de refresh:

```json
{
  "refreshToken": "<token-opaco-de-renovacao>"
}
```

Após refresh, usar o novo par e descartar o anterior. A mensagem passa a
ser "Sessão renovada com sucesso.". Respostas de tokens incluem
`Cache-Control: no-store` e `Pragma: no-cache`. Access token padrão: 15
minutos; sessão: até 7 dias; refresh: até 24 horas de inatividade, limitado
pela expiração absoluta da sessão. Reuso revoga a família e exige novo login.
Detalhes de armazenamento, concorrência e revogação estão em
[SECURITY_AND_TENANCY.md](SECURITY_AND_TENANCY.md).

Cadastro público confirmado por e-mail e redefinição via código foram
autorizados em 30/09/2026 e estão implementados. Solicitação recebe `{email}`
e retorna `{challengeId, expiresIn, resendAfter}` dentro do envelope padrão.
Cadastro recebe `{challengeId, code, displayName, password}` e retorna o
User público (sem emitir tokens automaticamente); recuperação recebe
`{challengeId, code, newPassword}` e revoga todas as sessões no sucesso.
Código: seis dígitos em string, 10 minutos, cinco tentativas, reenvio após
60 segundos, uso único e finalidade restrita. Senha nova tem 12–128 caracteres.
Respostas 202 usam o envelope padrão, além de 200/201. Códigos adicionais:
400 AUTH_INVALID_EMAIL_CODE e 503 EMAIL_DELIVERY_UNAVAILABLE. JSON acima
mostra contratos de tokens; os payloads/exemplos completos das novas rotas
estão no [guia de autenticação](../front-specs/authentication.md) e Swagger.
Cookie de refresh/CSRF será contratado antes de integração web persistente.

## Disponibilidade e Swagger

Nesta entrega estão implementados os nove endpoints de `/auth`, dois de
saúde, 48 endpoints de Workspace e 19 de Projetos e 26 de Casos de Teste e 24 de Planos/Execuções e 10 de Defeitos e 33 de Governança e 1 de visão geral (172 operações no total).
Requisitos e integrações são contratos planejados. Swagger UI: `/docs`; OpenAPI JSON: `/docs-json`, sem
prefixo `/api/v1`. Swagger habilitado por padrão em desenvolvimento e
desabilitado em produção, configurável por SWAGGER_ENABLED.

## Observabilidade e saúde

```text
GET /health/live   — 200 enquanto o processo estiver saudável
GET /health/ready  — 200 se apto a atender; 503 se dependências falharem
```

Rotas relativas a `/api/v1`, disponíveis no bootstrap, sem detalhes de
credenciais ou infraestrutura. Liveness não depende do banco; readiness
verifica MySQL. Sucesso usa o envelope padrão; 503 usa Problem Details.

## Workspace

Implementado na Fase 01 única, em 02/10/2026. Todas as rotas abaixo estão
disponíveis no Swagger, relativas a `/api/v1`. Contratos completos de DTOs,
exemplos, permissões, erros e fluxos estão em
[front-specs](../front-specs/README.md), com
[snapshot OpenAPI](../front-specs/openapi.json).
As [decisões de implementação](WORKSPACE_IMPLEMENTATION_DECISIONS.md)
consolidam o plano. Shared parameters e Shared steps estão excluídos.

```text
GET/POST /workspaces
GET/PATCH /workspaces/{workspaceId}
POST /workspaces/{workspaceId}/ownership/transfer
GET /workspaces/{workspaceId}/members
GET/PATCH/DELETE /workspaces/{workspaceId}/members/{memberId}
GET/POST /workspaces/{workspaceId}/invitations
GET/DELETE /workspaces/{workspaceId}/invitations/{invitationId}
POST /workspaces/{workspaceId}/invitations/{invitationId}/resend
POST /invitations/accept
GET /permissions
GET/POST /workspaces/{workspaceId}/roles
GET/PATCH/DELETE /workspaces/{workspaceId}/roles/{roleId}
PUT/DELETE /workspaces/{workspaceId}/members/{memberId}/roles/{roleId}
GET/POST /workspaces/{workspaceId}/groups
GET/PATCH/DELETE /workspaces/{workspaceId}/groups/{groupId}
GET /workspaces/{workspaceId}/groups/{groupId}/members
PUT/DELETE /workspaces/{workspaceId}/groups/{groupId}/members/{memberId}
PUT/DELETE /workspaces/{workspaceId}/groups/{groupId}/roles/{roleId}
GET/POST /workspaces/{workspaceId}/custom-fields
GET/PATCH /workspaces/{workspaceId}/custom-fields/{fieldId}
POST /workspaces/{workspaceId}/custom-fields/{fieldId}/archive
GET/POST /workspaces/{workspaceId}/tags
GET/PATCH/DELETE /workspaces/{workspaceId}/tags/{tagId}
GET/POST /workspaces/{workspaceId}/attachments
GET/DELETE /workspaces/{workspaceId}/attachments/{attachmentId}
GET /workspaces/{workspaceId}/attachments/{attachmentId}/download
```

Aceite de convite exige bearer e body `{ "token": "<token-do-convite>" }`;
o e-mail do usuário deve corresponder ao convite. Token não aparece na URL.
Convites são assíncronos quanto à entrega: 202 persiste a intenção e retorna
deliveryStatus; SENT indica aceite pelo SendGrid. E-mail usa fragmento no
link opcional do front. Não há fluxo de criação de User pelo administrador.

Owner é vínculo separado, só ele transfere ownership. Autorização resolve
membership/estado/permissões atuais por transação; revogações valem na próxima
requisição. Roles diretas e de grupos se somam, sem conceder além do ator.
Detalhes de capabilities e filtros estão no guia compartilhado de Workspace.
Listas usam data array e meta.pagination; download retorna bytes sem envelope,
com Content-Disposition attachment e MIME validado. Exclusões retornam 204.

## Projects

Fase 02 implementada: rotas desta seção disponíveis. Repository também está
implementado na Fase 03; Plans/Runs estão disponíveis na Fase 04; Defeitos estão disponíveis na Fase 05; demais seções permanecem planejadas. Contratos completos em [projects.md](../front-specs/projects.md)
e [project-contracts.md](../front-specs/project-contracts.md). São 19 endpoints.

```text
GET/POST /workspaces/{workspaceId}/projects
GET/PATCH /workspaces/{workspaceId}/projects/{projectId}
POST      /workspaces/{workspaceId}/projects/{projectId}/archive

GET /workspaces/{workspaceId}/projects/{projectId}/members
PUT/DELETE /workspaces/{workspaceId}/projects/{projectId}/members/{workspaceMemberId}
GET/POST /workspaces/{workspaceId}/projects/{projectId}/milestones
GET/PATCH/DELETE /workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}
POST /workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}/complete
GET/POST /workspaces/{workspaceId}/projects/{projectId}/environments
GET/PATCH/DELETE /workspaces/{workspaceId}/projects/{projectId}/environments/{environmentId}
```

## Repository — Fase 03

Implementado: 26 endpoints (contagens adicionadas em 03/10/2026). Prefixo comum:
`/workspaces/{workspaceId}/projects/{projectId}`, relativo a /api/v1.
[Guia por endpoint](../front-specs/test-cases.md),
[DTOs/acesso/valores/version](../front-specs/test-case-contracts.md) e
[decisões](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

```text
GET/POST /test-suites
PUT /test-suites/order
GET/PATCH /test-suites/{suiteId}
POST /test-suites/{suiteId}/move
POST /test-suites/{suiteId}/archive
GET/POST /test-cases
GET /test-cases/summary
GET/PATCH /test-cases/{caseId}
POST /test-cases/{caseId}/move
POST /test-cases/{caseId}/clone
POST /test-cases/{caseId}/archive
POST /test-cases/{caseId}/restore
GET/POST /test-cases/{caseId}/steps
PUT /test-cases/{caseId}/steps/order
PATCH/DELETE /test-cases/{caseId}/steps/{stepId}
PUT/DELETE /test-cases/{caseId}/tags/{tagId}
PUT/DELETE /test-cases/{caseId}/attachments/{attachmentId}
PUT /test-cases/{caseId}/custom-fields
```

Todas exigem bearer e escopo atual. Quatro permissions testcase.* intersectam
VIEWER/EDITOR/MANAGER. Mutações de caso/passos/vínculos exigem version e
retornam CaseResponse completo (incluindo DELETE, HTTP 200). Suite reorder
retorna array sem paginação; GET de passos também. Criação/clone de caso e
criação de suíte retornam 201/Location; demais operações 200.
`GET /test-cases/summary` aceita somente status DRAFT/ACTIVE/DEPRECATED/ARCHIVED/ALL,
opcional; ausência exclui arquivados como na listagem. Permission efetiva
`testcase.read`, UUID v4 e mesmo escopo Workspace/Projeto; arquivados consultáveis.
Retorna `{totalCases, suites: [{suiteId, totalCases}]}` no envelope normal,
sem paginação: inteiros não negativos, suiteId null para casos sem suíte,
grupos diretos sem descendentes e grupos vazios omitidos (vazio: 0 e []).
Consulta SQL agregada por suite_id com workspace_id/project_id/situação,
sem carregar definições/passos/vínculos. Rota estática antes de `:caseId`;
DTO/query próprios rejeitam paginação/busca/suíte. Sem migration ou novos
códigos de erro. Recarregar o front após atualizar a API para detectar a rota.

Novos erros: TEST_CASE_VERSION_CONFLICT, TEST_CASE_ARCHIVED,
TEST_CASE_NOT_ARCHIVED, TEST_CASE_SEQUENCE_EXHAUSTED, TEST_SUITE_ARCHIVED,
TEST_SUITE_CYCLE, TEST_SUITE_NOT_EMPTY (409); TEST_ORDER_INVALID,
CUSTOM_FIELD_REQUIRED, CUSTOM_FIELD_VALUE_INVALID (400); TAG_IN_USE (409)
no DELETE de Tag. JSON acima de 32 KiB retorna 413 PAYLOAD_TOO_LARGE.

## Plans/Runs — Fase 04

Implementado: 24 endpoints. Prefixo comum `/api/v1/workspaces/{workspaceId}/projects/{projectId}`.
[Guia por endpoint](../front-specs/execution.md) e [contratos](../front-specs/execution-contracts.md).

```text
GET    /.../{projectId}/test-plans
POST   /.../{projectId}/test-plans
GET    /.../{projectId}/test-plans/{planId}
PATCH  /.../{projectId}/test-plans/{planId}
GET    /.../{projectId}/test-plans/{planId}/cases
POST   /.../{projectId}/test-plans/{planId}/cases
DELETE /.../{projectId}/test-plans/{planId}/cases/{caseId}
PUT    /.../{projectId}/test-plans/{planId}/cases/order
POST   /.../{projectId}/test-plans/{planId}/activate
POST   /.../{projectId}/test-plans/{planId}/complete
POST   /.../{projectId}/test-plans/{planId}/archive
POST   /.../{projectId}/test-plans/{planId}/runs
GET    /.../{projectId}/test-runs
POST   /.../{projectId}/test-runs
GET    /.../{projectId}/test-runs/{runId}
GET    /.../{projectId}/test-runs/{runId}/cases
GET    /.../{projectId}/test-runs/{runId}/cases/{runCaseId}
POST   /.../{projectId}/test-runs/{runId}/start
POST   /.../{projectId}/test-runs/{runId}/complete
POST   /.../{projectId}/test-runs/{runId}/abort
PUT    /.../{projectId}/test-runs/{runId}/cases/{runCaseId}/result
PUT    /.../{projectId}/test-runs/{runId}/cases/{runCaseId}/steps/{runStepId}/result
GET    /.../{projectId}/test-runs/{runId}/comments
POST   /.../{projectId}/test-runs/{runId}/comments
```

Plan DRAFT/ACTIVE/COMPLETED/ARCHIVED; Run CREATED/IN_PROGRESS/COMPLETED/ABORTED.
Plan/Run version nas escritas; seleção 1–500 distintos (plano DRAFT pode vazio),
Run até 10000 passos, source MANUAL. Snapshots atômicos/imutáveis; resultados
explícitos e comentários somente IN_PROGRESS. Resultado de passo invalida caso.
Complete exige todos os casos finais; abort preserva resultados. Terminal sem reopen.
Plano ACTIVE congela seleção; cada Run copia definições atuais, com campos obrigatórios.
Acesso: testrun.read/execute/manage e capabilities locais; seleção/ativação/criação
exige testcase.read conforme contrato. Novas permissions totalizam 27.

Erros: TEST_SELECTION_INVALID, TEST_ORDER_INVALID, TEST_RUN_STEP_LIMIT,
VALIDATION_ERROR, CUSTOM_FIELD_REQUIRED/CUSTOM_FIELD_VALUE_INVALID (400);
TEST_PLAN_VERSION_CONFLICT, TEST_RUN_VERSION_CONFLICT, TEST_PLAN_NOT_DRAFT,
TEST_PLAN_STATE_INVALID, TEST_PLAN_NOT_ACTIVE, TEST_PLAN_RUNS_OPEN,
TEST_PLAN_CASE_EXISTS, TEST_CASE_NOT_EXECUTABLE, TEST_CONTEXT_UNAVAILABLE,
TEST_RUN_NOT_IN_PROGRESS, TEST_RUN_STATE_INVALID, TEST_RUN_INCOMPLETE,
TEST_RUN_STEPS_INCOMPLETE (409). JSON >32 KiB: PAYLOAD_TOO_LARGE (413).

## Defects — Fase 05

Implementado: 9 endpoints. Prefixo /api/v1/workspaces/{workspaceId}/projects/{projectId}.
[Guia](../front-specs/defects.md) e [contratos](../front-specs/defect-contracts.md).

```text
GET    /.../{projectId}/defects
POST   /.../{projectId}/defects
POST   /.../{projectId}/defects/from-failure
GET    /.../{projectId}/defects/{defectId}
PATCH  /.../{projectId}/defects/{defectId}
POST   /.../{projectId}/defects/{defectId}/external-link
DELETE /.../{projectId}/defects/{defectId}/external-link
POST   /.../{projectId}/defects/{defectId}/attachments
DELETE /.../{projectId}/defects/{defectId}/attachments/{attachmentId}
```

Defect nasce OPEN/version=1; sequence imutável e independente de TestCase,
humanId {Project.key}-DEF-{sequence}. Estados OPEN/IN_PROGRESS/RESOLVED/CLOSED/REJECTED,
PATCH com version permite alterar/reabrir e audita. Sem hard delete/archive.
Origem opcional FAILED de TestRunCase é imutável; criação não altera Run/snapshots.
Referência externa manual e anexos privados tipados; download continua com attachment.read.
Acesso defect.read/manage com capabilities locais; origem/filtro exige testrun.read,
anexar exige attachment.read. Catálogo atual: 32 permissions.

Erros: DEFECT_VERSION_CONFLICT, DEFECT_FAILURE_REQUIRED, DEFECT_SEQUENCE_EXHAUSTED,
DEFECT_ATTACHMENT_LIMIT (409); VALIDATION_ERROR (400) para DTO/URL/payload vazio;
PROJECT_ARCHIVED (409),
RESOURCE_NOT_FOUND (404), AUTH_FORBIDDEN (403), PAYLOAD_TOO_LARGE (413, JSON >32 KiB).
Tríade externa só aceita HTTP/HTTPS sem credenciais e sem chamadas remotas.
Lista combina filtros antes de paginação; contratos detalham nulos/version/retry.

## Requirements — planejado

```text
GET/POST /.../{projectId}/requirements
PATCH    /.../{projectId}/requirements/{id}
POST     /.../{projectId}/requirements/{id}/test-cases/{caseId}
DELETE   /.../{projectId}/requirements/{id}/test-cases/{caseId}
GET      /.../{projectId}/traceability

```

## Governance — Fase 06 entregue

32 operações, [contratos](../front-specs/governance-contracts.md),
[guias por endpoint](../front-specs/governance.md) e [decisões](GOVERNANCE_IMPLEMENTATION_DECISIONS.md).
Rotas relativas a /api/v1; grants read/assess/manage. Snapshot na criação,
N/A justificado, CLOSED terminal e indicador INTERNAL. Metas disponíveis apenas
AUTOMATION_COVERAGE, CRITICAL_DEFECTS e GOVERNANCE_SCORE.

```text
GET /workspaces/{workspaceId}/governance/frameworks
POST /workspaces/{workspaceId}/governance/frameworks
GET /workspaces/{workspaceId}/governance/frameworks/{id}
PATCH /workspaces/{workspaceId}/governance/frameworks/{id}
GET /workspaces/{workspaceId}/governance/assessments
POST /workspaces/{workspaceId}/governance/assessments
GET /workspaces/{workspaceId}/governance/assessments/{id}
GET /workspaces/{workspaceId}/governance/goals
POST /workspaces/{workspaceId}/governance/goals
GET /workspaces/{workspaceId}/governance/goals/{id}
PATCH /workspaces/{workspaceId}/governance/goals/{id}
GET /workspaces/{workspaceId}/governance/actions
POST /workspaces/{workspaceId}/governance/actions
GET /workspaces/{workspaceId}/governance/actions/{id}
PATCH /workspaces/{workspaceId}/governance/actions/{id}
GET /workspaces/{workspaceId}/governance/frameworks/{id}/sections
POST /workspaces/{workspaceId}/governance/frameworks/{id}/sections
PATCH /workspaces/{workspaceId}/governance/frameworks/{id}/sections/{childId}
GET /workspaces/{workspaceId}/governance/frameworks/{id}/controls
POST /workspaces/{workspaceId}/governance/frameworks/{id}/controls
PATCH /workspaces/{workspaceId}/governance/frameworks/{id}/controls/{childId}
POST /workspaces/{workspaceId}/governance/assessments/{id}/start
GET /workspaces/{workspaceId}/governance/assessments/{id}/controls
PUT /workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}
GET /workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}/evidence
POST /workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}/evidence
DELETE /workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}/evidence/{evidenceId}
POST /workspaces/{workspaceId}/governance/assessments/{id}/close
POST /workspaces/{workspaceId}/governance/goals/{id}/calculate
POST /workspaces/{workspaceId}/governance/actions/{id}/complete
GET /workspaces/{workspaceId}/governance/metrics
GET /workspaces/{workspaceId}/governance/dashboard
```

Definições filhas retornam section/control + frameworkVersion, e mutações de
resultado/evidência retornam Assessment com version atual. Demais agregados
retornam DTO completo. Criações 201/Location; demais 200; sucesso em envelope
JSON e listas paginadas. GET detalhe/metrics/dashboard sem query; mutações sem
query; DTOs explícitos, UUID v4, datas reais e validação pt-BR.

Extensão de 07/10/2026: PATCH actions/{id} aceita goalId opcional/nullable
(UUID v4 associa/troca; null remove; ausente mantém). Usa version da ação,
governance.manage e visibilidade da ação/meta no mesmo Workspace, incluindo
projetos ativos. Ação DONE/CANCELLED e destino CANCELLED bloqueiam a alteração.
controlAssessmentId permanece imutável. Atualiza/audita a ação e sincroniza situação/version das metas afetadas, sem
recalcular lastResult ou modificar avaliações. Sem nova rota/migration.

Códigos 409: GOVERNANCE_VERSION_CONFLICT, GOVERNANCE_FRAMEWORK_ARCHIVED,
GOVERNANCE_FRAMEWORK_EMPTY, GOVERNANCE_FRAMEWORK_INACTIVE,
GOVERNANCE_SECTION_CYCLE, GOVERNANCE_SECTION_DEPTH, GOVERNANCE_LIMIT,
GOVERNANCE_STATE_INVALID, GOVERNANCE_ASSESSMENT_LOCKED,
GOVERNANCE_ASSESSMENT_INCOMPLETE, GOVERNANCE_GOAL_CANCELLED,
GOVERNANCE_ACTION_TERMINAL; PROJECT_ARCHIVED/RESOURCE_CONFLICT reutilizados.
400 VALIDATION_ERROR, 403 AUTH_FORBIDDEN e 404 RESOURCE_NOT_FOUND mantêm padrão.
URL/anexo e combinação de escopo/tipo/operação inválidos usam 400.

## Automação

Endpoint dedicado, autenticado por credencial de integração:

```text
POST /api/v1/integrations/test-results
```

Payload deve aceitar `workspace/project`, source, externalRunRef,
environment, branch, commit e resultados mapeados por identificador
estável de TestCase.

## Status HTTP

201 criação; 200 leitura/alteração e autenticação; 204 exclusão/ação sem
corpo; 400 validação; 401 autenticação inválida; 403 sem permissão no
escopo visível; 404 recurso inexistente ou não visível; 409
conflito/invariante; 429 limite de tentativas; 500 erro inesperado;
503 serviço indisponível. Não adotar 422 sem revisar o contrato.

## Idempotência

Importações de pipeline devem aceitar chave idempotente/externalRunRef
para impedir Runs duplicados em retry. Escopar unicidade por Workspace,
Project e source; payload diferente para a mesma chave retorna 409.
Não aplicar retry automático de importação ao fluxo de refresh token.

## OpenAPI

Documentar DTOs, exemplos, filtros, paginação, status, headers, envelope de
sucesso e Problem Details. Definir security scheme HTTP `bearer` com
`bearerFormat: JWT` para rotas protegidas; login/refresh usam `security: []`.
Integrações possuem scheme próprio; nunca reutilizar refresh token.

## Instruções de integração para o front-end

Cada entrega de endpoint deve atualizar [front-specs/](../front-specs/README.md),
seguindo seu modelo de documentação. Incluir requisição, respostas, acesso,
tratamento de erros, fluxo de consumo e impactos de compatibilidade,
mantendo o guia consistente com o OpenAPI e o comportamento implementado.

## Visão geral do produto — 04/10/2026

GET `/api/v1/dashboard/overview`, operação `getDashboardOverview`. Bearer,
sem grant global; `days` 7/30/90/ALL, padrão 30, e workspaceId UUID v4 opcional.
Consolida fontes atualmente autorizadas nos Workspaces/projetos ativos.
Janelas UTC semiabertas retornadas em period; histórico de catálogo/cobertura
null. Cobertura de execução distinta com resultados PASSED/FAILED/BLOCKED,
por executedAt e catálogo atual; média simples entre projetos com base.
Results soma RunCases de Runs criadas no período; defect status é atual.
Métricas de metas persistidas sem recálculo; progresso/status por ações sem
escrita em GET. Arquivos privados sem bytes/URLs e
atividades reais filtradas. Limites 10 projetos/eventos, 6 metas/documentos;
totais completos independem das listas. Extensão de 07/10/2026:
metrics.automationCoverage = 100 × total AUTOMATED ativos / total ACTIVE
não arquivados autorizados; catálogo atual independente de days, proporção
consolidada entre todos os projetos (sem média simples nem limite de dez).
Somente testcase.read; previousValue null por falta de histórico.
projects[].activeTestCases/automationCoverage exigem testcase.read além da
visibilidade da linha por project.read; sem acesso null/null, vazio 0/null,
base não vazia sem automatizados contagem/0. NOT_APPLICABLE integra denominador.
metrics.activeTestCases soma o total ACTIVE não arquivado autorizado da
mesma projeção de automação, sem limite de linhas; sem fonte null, vazio 0,
previousValue null. metrics.testCases preserva o catálogo não arquivado geral.
period.supportedDays = [7,30,90,'ALL']. ALL remove o limite inferior temporal,
to = generatedAt exclusivo; from é o menor instante autorizado de criação de
Run/defeito, resultado exercitado ou auditoria elegível, antes dos limites,
ou null sem histórico. previousFrom/previousTo e todos os previousValue null.
Grants, tamanho das listas e indicadores atuais são preservados.
Campos existentes de execução preservados. Sem migration nova.
Sem grant: null; vazio autorizado:
zeros/[]; falha integral usa Problem Details. Cache-Control: no-store.

[Contrato, exemplos e integração](../front-specs/dashboard.md),
[decisões/índices](DASHBOARD_IMPLEMENTATION_DECISIONS.md).

## Extensões de 04/10/2026

- [Progresso de frameworks e metas por seção](../front-specs/framework-progress.md): leitura com snapshots e bloco frameworkGovernance na overview.
- [Ambientes e gráficos de bugs](../front-specs/defect-analytics.md): cadastro de ambientes para o front, associação no defeito e agregações por mês/projeto/categoria.
- Migrations aditivas `202610040008_framework_progress_goals` e `202610040009_defect_environments` nas duas histórias. Aplicar com `npm run migration:deploy` antes de reiniciar a API; não usar reset/db push.

## Armazenamento de anexos e evidências — 04/10/2026

Os endpoints de upload/download de anexos usam Oracle OCI Object Storage privado.
Contrato multipart, DTOs, limites, permissões, envelopes e vínculos existentes
preservados. Sem URL pública, redirecionamento ou chave OCI no cliente. Falhas
de upload/abertura do objeto usam `503 ATTACHMENT_STORAGE_UNAVAILABLE`; após
iniciado um stream, falha de transporte encerra a conexão, sem novo envelope.
Ver [guia de anexos](../front-specs/workspace-attachments.md) e
[operação/migração](OCI_STORAGE_IMPLEMENTATION_DECISIONS.md).

## Evoluções autorizadas de 06/10/2026

Implementados: [inventário de defeitos](../front-specs/defect-inventory.md),
[importação CSV](../front-specs/azure-test-case-import.md) e [cofre por projeto](../front-specs/test-vault.md).
[Decisões, migration e chave externa](PRODUCT_IMPROVEMENTS_20261006.md).
Controles têm creationOrder numérico imutável e ordenação padrão crescente.
Timestamps HTTP, inclusive envelopes/Problem Details, usam -03:00; instantes no
banco, expirações JWT e snapshots persistidos continuam UTC, DATE sem conversão.

## Conclusão de metas por ações — 07/10/2026

GovernanceGoalResponse e governance[] da overview acrescentam actionProgress
{basis:ACTIONS,totalActions,completedActions,cancelledActions,percent}.
Metas atingem com todas as ações não canceladas DONE e base positiva; sem base
percent null. Com pendência/sem base: ACTIVE/MISSED pelo prazo UTC. CANCELLED
manual da meta é preservado. progress/status/detail da overview usam essa base.
lastResult/currentValue/targetValue são informativos; índice do framework não muda.
Escritas de vínculo/status de ações sincronizam status/version das metas na
mesma transação. GET agrega estado atual sem gravação, inclusive para legado.
[Contrato e integração](../front-specs/goal-action-completion.md). Sem migration.

## Correção operacional — 08/10/2026

Operações autenticadas de Workspace/projeto/casos/planos/execuções/defeitos/
governança/anexos/cofre/dashboard não têm quota geral por usuário/IP.
WORKSPACE_RATE_LIMIT é descontinuado e ignorado. WorkspaceRequestGuard mantém
UUID v4, rejeição de query em mutações e Cache-Control: no-store; sessão e
autorização atual permanecem nas respectivas camadas. me/logout/logout-all
não usam a quota de identidade. Cadastro/login/refresh/redefinição preservam
AUTH_RATE_LIMIT e 429/Retry-After; reenvio de convites preserva
429 WORKSPACE_INVITATION_COOLDOWN. Removido 429 das demais operações no OpenAPI.

Cofre mantém DTOs/criptografia e 503 TEST_VAULT_UNAVAILABLE. Há diagnóstico
local sem segredos e setup explícito da chave, preservando IDs existentes;
chaves nunca são geradas automaticamente no startup. Sem migration.
[Configuração e integração](../front-specs/test-vault.md).
