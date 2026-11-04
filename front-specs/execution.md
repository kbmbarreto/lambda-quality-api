# Planos, execuções, resultados e comentários

- **Disponibilidade:** implementado, Fase 04.
- **Versão:** API v1; atualizado em 02/10/2026.
- **Referência OpenAPI:** [openapi.json](openapi.json); ao vivo em `/docs-json`.
- **Resumo:** 24 endpoints originais; extensões de 08/10/2026 em [JUnit, lotes e inventários](execution-imports-and-inventories.md). Ler [contratos e fluxo](execution-contracts.md)
  antes de integrar. IDs UUID v4 e timestamps com offset -03:00; mensagens pt-BR.

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans

### Objetivo e acesso

**operationId:** `listTestPlans`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. Padrão exclui ARCHIVED; status=ALL inclui histórico. q busca name; sort aceita name, createdAt ou updatedAt, padrão createdAt,asc.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                            |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                   |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                    |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                    |
| query  | page          | number              | não         | Mínimo: 1. Máximo: 100000. Padrão: 1.               |
| query  | size          | number              | não         | Mínimo: 1. Máximo: 100. Padrão: 20.                 |
| query  | sort          | string              | não         | campo,asc/desc; campos e padrão na seção de acesso. |
| query  | q             | string              | não         | Caracteres máximos: 100.                            |
| query  | status        | string              | não         | Enum: DRAFT, ACTIVE, COMPLETED, ARCHIVED, ALL.      |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans?page=1&size=20
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**[]; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp e pagination.

```json
{
  "data": [
    {
      "id": "00000003-0000-4000-8000-000000000001",
      "workspaceId": "00000001-0000-4000-8000-000000000001",
      "projectId": "00000002-0000-4000-8000-000000000001",
      "milestoneId": null,
      "environmentId": null,
      "name": "Regressão de login",
      "description": null,
      "status": "DRAFT",
      "version": 1,
      "createdBy": "00000008-0000-4000-8000-000000000001",
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "activatedAt": null,
      "completedAt": null,
      "archivedAt": null,
      "cases": [
        {
          "id": "00000012-0000-4000-8000-000000000001",
          "workspaceId": "00000001-0000-4000-8000-000000000001",
          "projectId": "00000002-0000-4000-8000-000000000001",
          "testPlanId": "00000003-0000-4000-8000-000000000001",
          "testCaseId": "00000005-0000-4000-8000-000000000001",
          "position": 1
        }
      ]
    }
  ],
  "message": "Planos consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Padrão exclui ARCHIVED; status=ALL inclui histórico. q busca name; sort aceita name, createdAt ou updatedAt, padrão createdAt,asc.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans

### Objetivo e acesso

**operationId:** `createTestPlan`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. Cria DRAFT/version=1. caseIds ausente/[] cria seleção vazia; com casos exige também testcase.read. Casos DRAFT/ACTIVE são selecionáveis, DEPRECATED/ARCHIVED não.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                    |
| ------ | ------------- | ------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                           |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| body   | name          | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 100. Trim; vazio/null inválidos.                 |
| body   | description   | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000.                              |
| body   | milestoneId   | uuid                | não         | Aceita null. Mesmo Workspace/Project, disponível; ausente mantém no PATCH, null limpa.      |
| body   | environmentId | uuid                | não         | Aceita null. Mesmo Workspace/Project, disponível; ausente mantém no PATCH, null limpa.      |
| body   | caseIds       | string[]            | não         | Itens mínimos: 0. Itens máximos: 500. UUID v4 distintos; ordem preservada; não aceita null. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "name": "Regressão de login",
  "description": null,
  "milestoneId": null,
  "environmentId": null,
  "caseIds": [
    "00000005-0000-4000-8000-000000000001"
  ]
}
```

### Respostas de sucesso

HTTP **201**; application/json, Cache-Control: no-store e X-Request-Id.
Location aponta para o recurso criado em `/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}`.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "DRAFT",
    "version": 1,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Plano criado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 400  | TEST_SELECTION_INVALID                                                                                                     | Seleção inválida.                                        | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CASE_NOT_EXECUTABLE                                                                                                   | Caso indisponível.                                       | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CONTEXT_UNAVAILABLE                                                                                                   | Ambiente inativo ou marco cancelado.                     | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Cria DRAFT/version=1. caseIds ausente/[] cria seleção vazia; com casos exige também testcase.read. Casos DRAFT/ACTIVE são selecionáveis, DEPRECATED/ARCHIVED não.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}

### Objetivo e acesso

**operationId:** `getTestPlan`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. Consulta metadados e seleção completa do plano, inclusive histórico arquivado.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras         |
| ------ | ------------- | ------------------- | ----------- | -------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado. |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado. |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado. |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "DRAFT",
    "version": 1,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Plano consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Consulta metadados e seleção completa do plano, inclusive histórico arquivado.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}

### Objetivo e acesso

**operationId:** `updateTestPlan`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. Somente DRAFT. Campos ausentes mantêm valor; description/milestoneId/environmentId null limpam. name null é inválido.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                               |
| ------ | ------------- | ------------------- | ----------- | -------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                      |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                       |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                       |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                                       |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1.                  |
| body   | name          | string              | não         | Caracteres mínimos: 1. Caracteres máximos: 100. Trim; vazio/null inválidos.            |
| body   | description   | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000.                         |
| body   | milestoneId   | uuid                | não         | Aceita null. Mesmo Workspace/Project, disponível; ausente mantém no PATCH, null limpa. |
| body   | environmentId | uuid                | não         | Aceita null. Mesmo Workspace/Project, disponível; ausente mantém no PATCH, null limpa. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
PATCH /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1,
  "name": "Regressão de autenticação",
  "description": null,
  "milestoneId": null,
  "environmentId": null
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de autenticação",
    "description": null,
    "status": "DRAFT",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Plano atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_NOT_DRAFT                                                                                                        | Plano não permite edição.                                | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CONTEXT_UNAVAILABLE                                                                                                   | Contexto indisponível.                                   | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Somente DRAFT. Campos ausentes mantêm valor; description/milestoneId/environmentId null limpam. name null é inválido.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/cases

### Objetivo e acesso

**operationId:** `listTestPlanCases`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. IDs e posições da seleção, ordenação padrão position,asc; sort aceita apenas position. Não aceita q. caseId para remoção e caseIds para reorder são IDs de TestCase, não desta junção.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                            |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                   |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                    |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                    |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                    |
| query  | page          | number              | não         | Mínimo: 1. Máximo: 100000. Padrão: 1.               |
| query  | size          | number              | não         | Mínimo: 1. Máximo: 100. Padrão: 20.                 |
| query  | sort          | string              | não         | campo,asc/desc; campos e padrão na seção de acesso. |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases?page=1&size=20
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanCaseResponse**[]; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp e pagination.

```json
{
  "data": [
    {
      "id": "00000012-0000-4000-8000-000000000001",
      "workspaceId": "00000001-0000-4000-8000-000000000001",
      "projectId": "00000002-0000-4000-8000-000000000001",
      "testPlanId": "00000003-0000-4000-8000-000000000001",
      "testCaseId": "00000005-0000-4000-8000-000000000001",
      "position": 1
    }
  ],
  "message": "Seleção consultada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

IDs e posições da seleção, ordenação padrão position,asc; sort aceita apenas position. Não aceita q. caseId para remoção e caseIds para reorder são IDs de TestCase, não desta junção.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/cases

### Objetivo e acesso

**operationId:** `addCaseToPlan`. Bearer; permission `testrun.manage + testcase.read`, com interseção
Workspace/role local. Somente DRAFT; aceita caso DRAFT/ACTIVE disponível. Não permite duplicar nem exceder 500. position ausente insere ao final; máximo atual é quantidade+1. Reposiciona densamente.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |
| body   | testCaseId    | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | position      | number              | não         | Mínimo: 1. Máximo: 500.                                               |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1,
  "testCaseId": "00000005-0000-4000-8000-000000000001",
  "position": 1
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "DRAFT",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Caso selecionado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_NOT_DRAFT                                                                                                        | Plano congelado.                                         | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_PLAN_CASE_EXISTS                                                                                                      | Caso já selecionado.                                     | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CASE_NOT_EXECUTABLE                                                                                                   | Caso indisponível.                                       | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_SELECTION_INVALID                                                                                                     | Limite de seleção.                                       | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_ORDER_INVALID                                                                                                         | Posição não cabe na seleção.                             | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Somente DRAFT; aceita caso DRAFT/ACTIVE disponível. Não permite duplicar nem exceder 500. position ausente insere ao final; máximo atual é quantidade+1. Reposiciona densamente.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/cases/{caseId}

### Objetivo e acesso

**operationId:** `removeCaseFromPlan`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. Somente DRAFT; envia JSON com version inclusive no DELETE. caseId é TestCase.id; remove apenas a seleção e recompõe posições.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | caseId        | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
DELETE /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases/00000005-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "DRAFT",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": null,
    "cases": []
  },
  "message": "Caso removido do plano com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_NOT_DRAFT                                                                                                        | Plano congelado.                                         | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases/00000005-0000-4000-8000-000000000001",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Somente DRAFT; envia JSON com version inclusive no DELETE. caseId é TestCase.id; remove apenas a seleção e recompõe posições.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/cases/order

### Objetivo e acesso

**operationId:** `reorderTestPlanCases`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. Somente DRAFT; caseIds deve conter exatamente toda seleção, sem duplicar, na ordem desejada. [] somente para seleção vazia. Ordem base 1.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                    |
| ------ | ------------- | ------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                           |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1.                       |
| body   | caseIds       | string[]            | sim         | Itens mínimos: 0. Itens máximos: 500. UUID v4 distintos; ordem preservada; não aceita null. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
PUT /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases/order
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1,
  "caseIds": [
    "00000005-0000-4000-8000-000000000001"
  ]
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "DRAFT",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Seleção ordenada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_NOT_DRAFT                                                                                                        | Plano congelado.                                         | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_ORDER_INVALID                                                                                                         | Lista não corresponde à seleção.                         | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/cases/order",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Somente DRAFT; caseIds deve conter exatamente toda seleção, sem duplicar, na ordem desejada. [] somente para seleção vazia. Ordem base 1.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/activate

### Objetivo e acesso

**operationId:** `activateTestPlan`. Bearer; permission `testrun.manage + testcase.read`, com interseção
Workspace/role local. DRAFT → ACTIVE; exige seleção não vazia e todos os casos ACTIVE. Congela metadados/seleção. Plano guarda referências; cada novo Run copia definições atuais.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/activate
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "ACTIVE",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": "2026-10-02T09:00:00.000-03:00",
    "completedAt": null,
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Plano ativado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_STATE_INVALID                                                                                                    | Origem não é DRAFT.                                      | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_SELECTION_INVALID                                                                                                     | Seleção vazia.                                           | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CASE_NOT_EXECUTABLE                                                                                                   | Caso não está ACTIVE.                                    | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/activate",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Transição repetida para o estado atual é 200 sem nova alteração somente com
version atual; version antiga retorna conflito. Não há chave de idempotência.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

DRAFT → ACTIVE; exige seleção não vazia e todos os casos ACTIVE. Congela metadados/seleção. Plano guarda referências; cada novo Run copia definições atuais.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/complete

### Objetivo e acesso

**operationId:** `completeTestPlan`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. ACTIVE → COMPLETED; exige não haver Runs CREATED/IN_PROGRESS do plano. Não exige Run anterior. Impede criar nova execução.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/complete
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 2
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "COMPLETED",
    "version": 3,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": "2026-10-02T09:00:00.000-03:00",
    "completedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Plano concluído com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_STATE_INVALID                                                                                                    | Origem não é ACTIVE.                                     | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_PLAN_RUNS_OPEN                                                                                                        | Há execução aberta.                                      | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/complete",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Transição repetida para o estado atual é 200 sem nova alteração somente com
version atual; version antiga retorna conflito. Não há chave de idempotência.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

ACTIVE → COMPLETED; exige não haver Runs CREATED/IN_PROGRESS do plano. Não exige Run anterior. Impede criar nova execução.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/archive

### Objetivo e acesso

**operationId:** `archiveTestPlan`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. DRAFT/ACTIVE/COMPLETED → ARCHIVED; exige não haver Runs CREATED/IN_PROGRESS. Histórico permanece consultável; sem restore.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/archive
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **PlanResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "name": "Regressão de login",
    "description": null,
    "status": "ARCHIVED",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "activatedAt": null,
    "completedAt": null,
    "archivedAt": "2026-10-02T09:00:00.000-03:00",
    "cases": [
      {
        "id": "00000012-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testPlanId": "00000003-0000-4000-8000-000000000001",
        "testCaseId": "00000005-0000-4000-8000-000000000001",
        "position": 1
      }
    ]
  },
  "message": "Plano arquivado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_RUNS_OPEN                                                                                                        | Há execução aberta.                                      | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/archive",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Transição repetida para o estado atual é 200 sem nova alteração somente com
version atual; version antiga retorna conflito. Não há chave de idempotência.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

DRAFT/ACTIVE/COMPLETED → ARCHIVED; exige não haver Runs CREATED/IN_PROGRESS. Histórico permanece consultável; sem restore.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/runs

### Objetivo e acesso

**operationId:** `createTestRunFromPlan`. Bearer; permission `testrun.manage + testcase.read`, com interseção
Workspace/role local. Plano ACTIVE não vazio; version é do plano. Herda seleção/ordem/contexto sem overrides. Todos os casos ACTIVE e campos obrigatórios atuais preenchidos. Cria snapshots atômicos e Run CREATED/version=1; não incrementa version do plano.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                    |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                           |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                            |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                            |
| path   | planId        | uuid                | sim         | Conforme contrato compartilhado.                                            |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1.       |
| body   | name          | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 100. Trim; vazio/null inválidos. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/runs
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 2,
  "name": "Regressão de login — rodada 1"
}
```

### Respostas de sucesso

HTTP **201**; application/json, Cache-Control: no-store e X-Request-Id.
Location aponta para o recurso criado em `/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}`.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": "00000003-0000-4000-8000-000000000001",
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": "Regressão de login",
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "CREATED",
    "version": 1,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": null,
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Execução criada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_PLAN_VERSION_CONFLICT                                                                                                 | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_PLAN_NOT_ACTIVE                                                                                                       | Plano não ACTIVE.                                        | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CASE_NOT_EXECUTABLE                                                                                                   | Caso não ACTIVE.                                         | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CONTEXT_UNAVAILABLE                                                                                                   | Contexto indisponível.                                   | Corrigir pré-condição e reconsultar recurso.           |
| 400  | CUSTOM_FIELD_REQUIRED                                                                                                      | Falta campo obrigatório atual.                           | Corrigir pré-condição e reconsultar recurso.           |
| 400  | CUSTOM_FIELD_VALUE_INVALID                                                                                                 | Valor não atende definição atual.                        | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_RUN_STEP_LIMIT                                                                                                        | Mais de 10000 passos somados.                            | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_SELECTION_INVALID                                                                                                     | Seleção vazia, duplicada ou >500.                        | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-plans/00000003-0000-4000-8000-000000000001/runs",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Plano ACTIVE não vazio; version é do plano. Herda seleção/ordem/contexto sem overrides. Todos os casos ACTIVE e campos obrigatórios atuais preenchidos. Cria snapshots atômicos e Run CREATED/version=1; não incrementa version do plano.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs

### Objetivo e acesso

**operationId:** `listTestRuns`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. Padrão inclui todos os estados; status filtra e ALL remove filtro. testPlanId filtra somente plano do escopo. q busca name; sort aceita name, createdAt, startedAt, finishedAt, padrão createdAt,asc.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                             |
| ------ | ------------- | ------------------- | ----------- | ---------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                    |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                     |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                     |
| query  | page          | number              | não         | Mínimo: 1. Máximo: 100000. Padrão: 1.                |
| query  | size          | number              | não         | Mínimo: 1. Máximo: 100. Padrão: 20.                  |
| query  | sort          | string              | não         | campo,asc/desc; campos e padrão na seção de acesso.  |
| query  | q             | string              | não         | Caracteres máximos: 100.                             |
| query  | status        | string              | não         | Enum: CREATED, IN_PROGRESS, COMPLETED, ABORTED, ALL. |
| query  | testPlanId    | uuid                | não         | Conforme contrato compartilhado.                     |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs?page=1&size=20
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**[]; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp e pagination.

```json
{
  "data": [
    {
      "id": "00000004-0000-4000-8000-000000000001",
      "workspaceId": "00000001-0000-4000-8000-000000000001",
      "projectId": "00000002-0000-4000-8000-000000000001",
      "testPlanId": null,
      "milestoneId": null,
      "environmentId": null,
      "planNameSnapshot": null,
      "milestoneSnapshot": null,
      "environmentSnapshot": null,
      "name": "Regressão de login — rodada 1",
      "source": "MANUAL",
      "externalRunRef": null,
      "status": "CREATED",
      "version": 1,
      "createdBy": "00000008-0000-4000-8000-000000000001",
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "startedAt": null,
      "finishedAt": null,
      "summary": {
        "total": 1,
        "notTested": 1,
        "passed": 0,
        "failed": 0,
        "blocked": 0,
        "skipped": 0
      }
    }
  ],
  "message": "Execuções consultadas com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Padrão inclui todos os estados; status filtra e ALL remove filtro. testPlanId filtra somente plano do escopo. q busca name; sort aceita name, createdAt, startedAt, finishedAt, padrão createdAt,asc.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs

### Objetivo e acesso

**operationId:** `createAdHocTestRun`. Bearer; permission `testrun.manage + testcase.read`, com interseção
Workspace/role local. Exige 1–500 TestCase IDs distintos e ACTIVE, com campos obrigatórios atuais. Cria Run CREATED/version=1 e snapshots atômicos na ordem enviada. Não aceita source, externalRunRef ou snapshots do cliente.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                    |
| ------ | ------------- | ------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                           |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                            |
| body   | name          | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 100. Trim; vazio/null inválidos.                 |
| body   | caseIds       | string[]            | sim         | Itens mínimos: 1. Itens máximos: 500. UUID v4 distintos; ordem preservada; não aceita null. |
| body   | milestoneId   | uuid                | não         | Aceita null. Mesmo Workspace/Project, disponível; ausente mantém no PATCH, null limpa.      |
| body   | environmentId | uuid                | não         | Aceita null. Mesmo Workspace/Project, disponível; ausente mantém no PATCH, null limpa.      |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "name": "Regressão de login — rodada 1",
  "caseIds": [
    "00000005-0000-4000-8000-000000000001"
  ],
  "milestoneId": null,
  "environmentId": null
}
```

### Respostas de sucesso

HTTP **201**; application/json, Cache-Control: no-store e X-Request-Id.
Location aponta para o recurso criado em `/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}`.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "CREATED",
    "version": 1,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": null,
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Execução criada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_CASE_NOT_EXECUTABLE                                                                                                   | Caso não ACTIVE.                                         | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_CONTEXT_UNAVAILABLE                                                                                                   | Contexto indisponível.                                   | Corrigir pré-condição e reconsultar recurso.           |
| 400  | CUSTOM_FIELD_REQUIRED                                                                                                      | Falta campo obrigatório atual.                           | Corrigir pré-condição e reconsultar recurso.           |
| 400  | CUSTOM_FIELD_VALUE_INVALID                                                                                                 | Valor não atende definição atual.                        | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_RUN_STEP_LIMIT                                                                                                        | Mais de 10000 passos somados.                            | Corrigir pré-condição e reconsultar recurso.           |
| 400  | TEST_SELECTION_INVALID                                                                                                     | Seleção vazia, duplicada ou >500.                        | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Exige 1–500 TestCase IDs distintos e ACTIVE, com campos obrigatórios atuais. Cria Run CREATED/version=1 e snapshots atômicos na ordem enviada. Não aceita source, externalRunRef ou snapshots do cliente.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}

### Objetivo e acesso

**operationId:** `getTestRun`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. Retorna metadados, contexto copiado, version e summary dos resultados de casos. Não carrega as cópias; consulte /cases.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras         |
| ------ | ------------- | ------------------- | ----------- | -------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado. |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado. |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado. |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "CREATED",
    "version": 1,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": null,
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Execução consultada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Retorna metadados, contexto copiado, version e summary dos resultados de casos. Não carrega as cópias; consulte /cases.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/cases

### Objetivo e acesso

**operationId:** `listTestRunCases`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. Retorna cópias com passos; result filtra estado do resultado (não status). q busca titleSnapshot; sort position/titleSnapshot, padrão position,asc. As contagens são da seleção filtrada.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                 |
| ------ | ------------- | ------------------- | ----------- | -------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                        |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                         |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                         |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                         |
| query  | page          | number              | não         | Mínimo: 1. Máximo: 100000. Padrão: 1.                    |
| query  | size          | number              | não         | Mínimo: 1. Máximo: 100. Padrão: 20.                      |
| query  | sort          | string              | não         | campo,asc/desc; campos e padrão na seção de acesso.      |
| query  | q             | string              | não         | Caracteres máximos: 100.                                 |
| query  | result        | string              | não         | Enum: NOT_TESTED, PASSED, FAILED, BLOCKED, SKIPPED, ALL. |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases?page=1&size=20
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunCaseResponse**[]; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp e pagination.

```json
{
  "data": [
    {
      "id": "00000006-0000-4000-8000-000000000001",
      "workspaceId": "00000001-0000-4000-8000-000000000001",
      "projectId": "00000002-0000-4000-8000-000000000001",
      "testRunId": "00000004-0000-4000-8000-000000000001",
      "testCaseId": "00000005-0000-4000-8000-000000000001",
      "position": 1,
      "caseSequenceSnapshot": 1,
      "humanIdSnapshot": "QA-1",
      "titleSnapshot": "Login com credenciais válidas",
      "severitySnapshot": "NORMAL",
      "prioritySnapshot": "MEDIUM",
      "definitionSnapshot": {
        "description": null,
        "preconditions": null,
        "postconditions": null,
        "type": "FUNCTIONAL",
        "layer": "E2E",
        "behavior": null,
        "automationStatus": "MANUAL",
        "suiteId": null,
        "status": "ACTIVE",
        "version": 1
      },
      "customFieldsSnapshot": [
        {
          "fieldId": "00000009-0000-4000-8000-000000000001",
          "key": "critical",
          "name": "Crítico",
          "type": "BOOLEAN",
          "required": true,
          "options": [],
          "archivedAt": null,
          "value": false
        }
      ],
      "tagsSnapshot": [
        {
          "id": "00000010-0000-4000-8000-000000000001",
          "name": "Login"
        }
      ],
      "result": "NOT_TESTED",
      "executedBy": null,
      "executedAt": null,
      "comment": null,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "steps": [
        {
          "id": "00000007-0000-4000-8000-000000000001",
          "workspaceId": "00000001-0000-4000-8000-000000000001",
          "projectId": "00000002-0000-4000-8000-000000000001",
          "testRunId": "00000004-0000-4000-8000-000000000001",
          "testRunCaseId": "00000006-0000-4000-8000-000000000001",
          "sourceStepId": "00000011-0000-4000-8000-000000000001",
          "position": 1,
          "actionSnapshot": "Entrar com credenciais válidas.",
          "testDataSnapshot": null,
          "expectedResultSnapshot": "Exibir painel.",
          "actualResult": null,
          "result": "NOT_TESTED",
          "comment": null,
          "executedBy": null,
          "executedAt": null
        }
      ]
    }
  ],
  "message": "Casos da execução consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Retorna cópias com passos; result filtra estado do resultado (não status). q busca titleSnapshot; sort position/titleSnapshot, padrão position,asc. As contagens são da seleção filtrada.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/cases/{runCaseId}

### Objetivo e acesso

**operationId:** `getTestRunCase`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. runCaseId é ID da cópia obtido em GET /test-runs/{runId}/cases. Exibe snapshots e resultados separados; runStepId vem de steps[].id.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras         |
| ------ | ------------- | ------------------- | ----------- | -------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado. |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado. |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado. |
| path   | runCaseId     | uuid                | sim         | Conforme contrato compartilhado. |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases/00000006-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunCaseResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000006-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testRunId": "00000004-0000-4000-8000-000000000001",
    "testCaseId": "00000005-0000-4000-8000-000000000001",
    "position": 1,
    "caseSequenceSnapshot": 1,
    "humanIdSnapshot": "QA-1",
    "titleSnapshot": "Login com credenciais válidas",
    "severitySnapshot": "NORMAL",
    "prioritySnapshot": "MEDIUM",
    "definitionSnapshot": {
      "description": null,
      "preconditions": null,
      "postconditions": null,
      "type": "FUNCTIONAL",
      "layer": "E2E",
      "behavior": null,
      "automationStatus": "MANUAL",
      "suiteId": null,
      "status": "ACTIVE",
      "version": 1
    },
    "customFieldsSnapshot": [
      {
        "fieldId": "00000009-0000-4000-8000-000000000001",
        "key": "critical",
        "name": "Crítico",
        "type": "BOOLEAN",
        "required": true,
        "options": [],
        "archivedAt": null,
        "value": false
      }
    ],
    "tagsSnapshot": [
      {
        "id": "00000010-0000-4000-8000-000000000001",
        "name": "Login"
      }
    ],
    "result": "NOT_TESTED",
    "executedBy": null,
    "executedAt": null,
    "comment": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "steps": [
      {
        "id": "00000007-0000-4000-8000-000000000001",
        "workspaceId": "00000001-0000-4000-8000-000000000001",
        "projectId": "00000002-0000-4000-8000-000000000001",
        "testRunId": "00000004-0000-4000-8000-000000000001",
        "testRunCaseId": "00000006-0000-4000-8000-000000000001",
        "sourceStepId": "00000011-0000-4000-8000-000000000001",
        "position": 1,
        "actionSnapshot": "Entrar com credenciais válidas.",
        "testDataSnapshot": null,
        "expectedResultSnapshot": "Exibir painel.",
        "actualResult": null,
        "result": "NOT_TESTED",
        "comment": null,
        "executedBy": null,
        "executedAt": null
      }
    ]
  },
  "message": "Caso da execução consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases/00000006-0000-4000-8000-000000000001",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

runCaseId é ID da cópia obtido em GET /test-runs/{runId}/cases. Exibe snapshots e resultados separados; runStepId vem de steps[].id.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/start

### Objetivo e acesso

**operationId:** `startTestRun`. Bearer; permission `testrun.execute`, com interseção
Workspace/role local. CREATED → IN_PROGRESS; servidor define startedAt. Apenas depois aceita resultados/comentários.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/start
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "IN_PROGRESS",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": "2026-10-02T09:00:00.000-03:00",
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Execução iniciada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_RUN_VERSION_CONFLICT                                                                                                  | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_RUN_STATE_INVALID                                                                                                     | Origem não é CREATED.                                    | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/start",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Transição repetida para o estado atual é 200 sem nova alteração somente com
version atual; version antiga retorna conflito. Não há chave de idempotência.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

CREATED → IN_PROGRESS; servidor define startedAt. Apenas depois aceita resultados/comentários.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/complete

### Objetivo e acesso

**operationId:** `completeTestRun`. Bearer; permission `testrun.execute`, com interseção
Workspace/role local. IN_PROGRESS → COMPLETED; todos os casos precisam de resultado diferente de NOT_TESTED. PASSED exige passos PASSED/SKIPPED. Define finishedAt e congela; sem reopen.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/complete
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 4
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "COMPLETED",
    "version": 5,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": "2026-10-02T09:00:00.000-03:00",
    "finishedAt": "2026-10-02T09:00:00.000-03:00",
    "summary": {
      "total": 1,
      "notTested": 0,
      "passed": 1,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Execução concluída com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_RUN_VERSION_CONFLICT                                                                                                  | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_RUN_STATE_INVALID                                                                                                     | Origem não é IN_PROGRESS.                                | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_RUN_INCOMPLETE                                                                                                        | Caso NOT_TESTED.                                         | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_RUN_STEPS_INCOMPLETE                                                                                                  | Caso PASSED tem passos pendentes.                        | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/complete",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Transição repetida para o estado atual é 200 sem nova alteração somente com
version atual; version antiga retorna conflito. Não há chave de idempotência.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

IN_PROGRESS → COMPLETED; todos os casos precisam de resultado diferente de NOT_TESTED. PASSED exige passos PASSED/SKIPPED. Define finishedAt e congela; sem reopen.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/abort

### Objetivo e acesso

**operationId:** `abortTestRun`. Bearer; permission `testrun.manage`, com interseção
Workspace/role local. CREATED/IN_PROGRESS → ABORTED; define finishedAt, preserva todos os resultados parciais, inclusive NOT_TESTED. Sem reopen.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                              |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                     |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                      |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                                      |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/abort
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "ABORTED",
    "version": 2,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": null,
    "finishedAt": "2026-10-02T09:00:00.000-03:00",
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Execução abortada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_RUN_VERSION_CONFLICT                                                                                                  | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_RUN_STATE_INVALID                                                                                                     | Execução terminal.                                       | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/abort",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Transição repetida para o estado atual é 200 sem nova alteração somente com
version atual; version antiga retorna conflito. Não há chave de idempotência.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

CREATED/IN_PROGRESS → ABORTED; define finishedAt, preserva todos os resultados parciais, inclusive NOT_TESTED. Sem reopen.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/cases/{runCaseId}/result

### Objetivo e acesso

**operationId:** `recordTestRunCaseResult`. Bearer; permission `testrun.execute`, com interseção
Workspace/role local. Exige IN_PROGRESS e version do Run. Resultado explícito: PASSED requer passos PASSED/SKIPPED; caso sem passos pode passar diretamente. FAILED/BLOCKED/SKIPPED permitem parar antes. NOT_TESTED limpa autor/data; comment ausente mantém, null limpa.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                                         |
| ------ | ------------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                                                |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | runCaseId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1.                                            |
| body   | result        | string              | sim         | Enum: NOT_TESTED, PASSED, FAILED, BLOCKED, SKIPPED.                                                              |
| body   | comment       | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000. Ausente mantém, null limpa, até 10000 caracteres. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
PUT /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases/00000006-0000-4000-8000-000000000001/result
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 3,
  "result": "PASSED",
  "comment": null
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "IN_PROGRESS",
    "version": 4,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": "2026-10-02T09:00:00.000-03:00",
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 0,
      "passed": 1,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Resultado do caso registrado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_RUN_VERSION_CONFLICT                                                                                                  | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_RUN_NOT_IN_PROGRESS                                                                                                   | Execução não está IN_PROGRESS.                           | Corrigir pré-condição e reconsultar recurso.           |
| 409  | TEST_RUN_STEPS_INCOMPLETE                                                                                                  | Passos não permitem PASSED.                              | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases/00000006-0000-4000-8000-000000000001/result",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Exige IN_PROGRESS e version do Run. Resultado explícito: PASSED requer passos PASSED/SKIPPED; caso sem passos pode passar diretamente. FAILED/BLOCKED/SKIPPED permitem parar antes. NOT_TESTED limpa autor/data; comment ausente mantém, null limpa.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/cases/{runCaseId}/steps/{runStepId}/result

### Objetivo e acesso

**operationId:** `recordTestRunStepResult`. Bearer; permission `testrun.execute`, com interseção
Workspace/role local. Exige IN_PROGRESS e version do Run. Atualiza passo da cópia e invalida resultado agregado do caso para NOT_TESTED, limpando seu autor/data. Reconfirmar caso depois. actualResult/comment ausentes mantêm; null limpa. Snapshot permanece igual.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                                         |
| ------ | ------------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                                                |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | runCaseId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| path   | runStepId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                 |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1.                                            |
| body   | result        | string              | sim         | Enum: NOT_TESTED, PASSED, FAILED, BLOCKED, SKIPPED.                                                              |
| body   | comment       | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000. Ausente mantém, null limpa, até 10000 caracteres. |
| body   | actualResult  | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000. Ausente mantém, null limpa, até 10000 caracteres. |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
PUT /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases/00000006-0000-4000-8000-000000000001/steps/00000007-0000-4000-8000-000000000001/result
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 2,
  "result": "PASSED",
  "actualResult": "Painel exibido.",
  "comment": null
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "IN_PROGRESS",
    "version": 3,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": "2026-10-02T09:00:00.000-03:00",
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Resultado do passo registrado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_RUN_VERSION_CONFLICT                                                                                                  | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_RUN_NOT_IN_PROGRESS                                                                                                   | Execução não está IN_PROGRESS.                           | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/cases/00000006-0000-4000-8000-000000000001/steps/00000007-0000-4000-8000-000000000001/result",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Exige IN_PROGRESS e version do Run. Atualiza passo da cópia e invalida resultado agregado do caso para NOT_TESTED, limpando seu autor/data. Reconfirmar caso depois. actualResult/comment ausentes mantêm; null limpa. Snapshot permanece igual.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/comments

### Objetivo e acesso

**operationId:** `listExecutionComments`. Bearer; permission `testrun.read`, com interseção
Workspace/role local. Comentários imutáveis do Run com alvo opcional; q busca text. sort aceita createdAt, padrão createdAt,asc. Inclui comentários de Run/caso/passo; comentários de resultado são campos separados.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                            |
| ------ | ------------- | ------------------- | ----------- | --------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                   |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                    |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                    |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                    |
| query  | page          | number              | não         | Mínimo: 1. Máximo: 100000. Padrão: 1.               |
| query  | size          | number              | não         | Mínimo: 1. Máximo: 100. Padrão: 20.                 |
| query  | sort          | string              | não         | campo,asc/desc; campos e padrão na seção de acesso. |
| query  | q             | string              | não         | Caracteres máximos: 100.                            |

Sem body. Aceita apenas query documentada; detalhe GET não aceita query.
Listagem vazia: 200/data=[], totalItems/totalPages=0, ambos has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/comments?page=1&size=20
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **ExecutionCommentResponse**[]; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp e pagination.

```json
{
  "data": [
    {
      "id": "00000013-0000-4000-8000-000000000001",
      "workspaceId": "00000001-0000-4000-8000-000000000001",
      "projectId": "00000002-0000-4000-8000-000000000001",
      "testRunId": "00000004-0000-4000-8000-000000000001",
      "runCaseId": "00000006-0000-4000-8000-000000000001",
      "runStepId": "00000007-0000-4000-8000-000000000001",
      "text": "Execução conferida no ambiente de QA.",
      "createdBy": "00000008-0000-4000-8000-000000000001",
      "createdAt": "2026-10-02T09:00:00.000-03:00"
    }
  ],
  "message": "Comentários consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/comments",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Comentários imutáveis do Run com alvo opcional; q busca text. sort aceita createdAt, padrão createdAt,asc. Inclui comentários de Run/caso/passo; comentários de resultado são campos separados.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/comments

### Objetivo e acesso

**operationId:** `addExecutionComment`. Bearer; permission `testrun.execute`, com interseção
Workspace/role local. Exige IN_PROGRESS e version do Run; text trim 1–10000. Alvos opcionais/nulos: sem alvo é do Run; runStepId exige runCaseId correspondente. Adiciona comentário imutável e retorna RunResponse/version; obter comentário em GET /comments.

workspaceId/projectId vêm das listas de Workspace/Projetos; planId/runId das
consultas/criações deste guia; caseId/testCaseId da biblioteca de casos.
runCaseId/runStepId são IDs das cópias, obtidos em /test-runs/{runId}/cases.
Mutação exige projeto ACTIVE. Recurso fora do escopo responde 404.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                      |
| ------ | ------------- | ------------------- | ----------- | ----------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                             |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                              |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                              |
| path   | runId         | uuid                | sim         | Conforme contrato compartilhado.                                              |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Versão atual do agregado; inteiro >=1.         |
| body   | text          | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 10000. Trim; vazio/null inválidos. |
| body   | runCaseId     | uuid                | não         | Aceita null.                                                                  |
| body   | runStepId     | uuid                | não         | Aceita null.                                                                  |

JSON application/json, máximo 32 KiB nas escritas. Campos extras são rejeitados.
GET de detalhe não aceita query; mutações não aceitam query. Listagens aceitam
somente a query acima; page=1/size=20, size máximo 100, desempate por id.

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/comments
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 2,
  "text": "Execução conferida no ambiente de QA.",
  "runCaseId": "00000006-0000-4000-8000-000000000001",
  "runStepId": "00000007-0000-4000-8000-000000000001"
}
```

### Respostas de sucesso

HTTP **200**; application/json, Cache-Control: no-store e X-Request-Id.
Campos de data: **RunResponse**; tipos/nulos e modelos aninhados em
[contratos compartilhados](execution-contracts.md). meta traz requestId/timestamp.

```json
{
  "data": {
    "id": "00000004-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "testPlanId": null,
    "milestoneId": null,
    "environmentId": null,
    "planNameSnapshot": null,
    "milestoneSnapshot": null,
    "environmentSnapshot": null,
    "name": "Regressão de login — rodada 1",
    "source": "MANUAL",
    "externalRunRef": null,
    "status": "IN_PROGRESS",
    "version": 3,
    "createdBy": "00000008-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "startedAt": "2026-10-02T09:00:00.000-03:00",
    "finishedAt": null,
    "summary": {
      "total": 1,
      "notTested": 1,
      "passed": 0,
      "failed": 0,
      "blocked": 0,
      "skipped": 0
    }
  },
  "message": "Comentário registrado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                            | Tratamento esperado                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, UUID, query ou campos extras inválidos.             | Associar errors[].field aos campos; manter formulário. |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/token inválido.                                   | Aplicar fluxo de autenticação.                         |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grants/capability insuficientes.                         | Atualizar acesso e ocultar ação.                       |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Recurso/seleção/alvo/contexto fora do escopo ou ausente. | Atualizar lista sem procurar em outro tenant.          |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto bloqueia escrita.                                | Atualizar projeto e acesso.                            |
| 409  | TEST_RUN_VERSION_CONFLICT                                                                                                  | Versão desatualizada.                                    | Reconsultar agregado e conciliar antes de reenviar.    |
| 409  | TEST_RUN_NOT_IN_PROGRESS                                                                                                   | Execução não está IN_PROGRESS.                           | Corrigir pré-condição e reconsultar recurso.           |
| 400  | VALIDATION_ERROR                                                                                                           | Passo informado sem caso.                                | Corrigir pré-condição e reconsultar recurso.           |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON maior que 32 KiB.                                   | Reduzir body.                                          |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                        | Preservar requestId; confirmar estado de escrita.      |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                             | Leitura pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/test-runs/00000004-0000-4000-8000-000000000001/comments",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00",
  "errors": [
    {
      "field": "unexpected",
      "code": "UNEXPECTED_FIELD",
      "message": "Este campo não é permitido."
    }
  ]
}
```

Preservar requestId para suporte e tratar HTTP/code, sem depender do texto.
errors é opcional, associar campos quando presente. Falha de rede/timeout não
confirma rollback. GET pode repetir com backoff; antes de repetir mutação,
consultar estado/version e, para criação/comentário, a lista correspondente.
Criação/comentário não são idempotentes. Escritas de resultado e seleção
exigem version e incrementam o agregado; não repetir automaticamente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita, ler version atual.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version retornados e invalidar caches por Workspace/Project/planId/runId.
4. Reconsultar casos/passos/comentários afetados; tratar validação/conflitos,
   sessão e permissão, encerrando loading.

Exige IN_PROGRESS e version do Run; text trim 1–10000. Alvos opcionais/nulos: sem alvo é do Run; runStepId exige runCaseId correspondente. Adiciona comentário imutável e retorna RunResponse/version; obter comentário em GET /comments.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 04; primeira versão pública deste endpoint.
- Consumidor integra os novos estados, snapshots e version do agregado.
- Migration `202610020004_execution` antes da API; atualizar catálogo de
  permissions e grants customizados conforme [contratos](execution-contracts.md).
- Sem execução automatizada, reopen ou Shared steps/parameters nesta fase.
- Defeitos possuem módulo próprio na [Fase 05](defect-contracts.md).
- Verificação: tipos/lint/build, HTTP e MySQL 8.4 real; isolamento, concorrência,
  upgrade e snapshots cobertos em [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).
