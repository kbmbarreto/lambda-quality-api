# Governança — endpoints

Disponibilidade: implementado na Fase 06, API v1, 03/10/2026. 32 operações.
Atualização de 07/10/2026: vínculo de ações via PATCH e conclusão automática de metas por ações, sem nova rota.
Ler também [conclusão das metas por ações](goal-action-completion.md).
Ler [contratos, acesso e fluxos](governance-contracts.md); [OpenAPI](openapi.json),
Swagger `/docs`, contrato ao vivo `/docs-json`. IDs fictícios nos exemplos;
substituir pelos retornados pela API. Sem metas de requisitos/flaky ou certificação.

## GET /api/v1/workspaces/{workspaceId}/governance/frameworks

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceFrameworks`. Registros consultados com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |
| query | status | enum DRAFT, ACTIVE, ARCHIVED, ALL | não | Ver regras de negócio no contrato. |

Sort permitido: code/name/createdAt/updatedAt; padrão name,asc. Desempate UUID asc. q busca literal em code/name. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceFrameworkResponse](governance-contracts.md#governanceframeworkresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000003-0003-4003-8003-000000000003",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "description": null,
      "status": "ACTIVE",
      "version": 4,
      "createdAt": "2026-10-03T09:00:00.000-03:00",
      "updatedAt": "2026-10-03T09:00:00.000-03:00"
    }
  ],
  "message": "Registros consultados com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/frameworks

### Objetivo e acesso

**OpenAPI operationId:** `createGovernanceFramework`. Registro criado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | code | string | sim | mín. caracteres 1; máx. caracteres 50 |
| body | name | string | sim | mín. caracteres 1; máx. caracteres 100 |
| body | versionLabel | string | sim | mín. caracteres 1; máx. caracteres 50 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "code": "QA",
  "name": "Política interna",
  "versionLabel": "1.0",
  "description": null
}
```

### Respostas de sucesso

HTTP **201**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Location aponta recurso criado; seções/controles apontam coleção filha. Campos de data: [GovernanceFrameworkResponse](governance-contracts.md#governanceframeworkresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000003-0003-4003-8003-000000000003",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "code": "QA",
    "name": "Política interna",
    "versionLabel": "1.0",
    "description": null,
    "status": "DRAFT",
    "version": 1,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Registro criado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | RESOURCE_CONFLICT | Código já existente no escopo. | Consultar recurso e corrigir código. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}

### Objetivo e acesso

**OpenAPI operationId:** `getGovernanceFramework`. Registro consultado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |

Não aceita query; enviar GET sem body.

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceFrameworkResponse](governance-contracts.md#governanceframeworkresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000003-0003-4003-8003-000000000003",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "code": "QA",
    "name": "Política interna",
    "versionLabel": "1.0",
    "description": null,
    "status": "ACTIVE",
    "version": 4,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Registro consultado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## PATCH /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}

### Objetivo e acesso

**OpenAPI operationId:** `updateGovernanceFramework`. Registro atualizado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | code | string | não | mín. caracteres 1; máx. caracteres 50 |
| body | name | string | não | mín. caracteres 1; máx. caracteres 100 |
| body | versionLabel | string | não | mín. caracteres 1; máx. caracteres 50 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | status | enum DRAFT, ACTIVE, ARCHIVED | não | Ver regras de negócio no contrato. |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
PATCH /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 3,
  "status": "ACTIVE"
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceFrameworkResponse](governance-contracts.md#governanceframeworkresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000003-0003-4003-8003-000000000003",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "code": "QA",
    "name": "Política interna",
    "versionLabel": "1.0",
    "description": null,
    "status": "ACTIVE",
    "version": 4,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Registro atualizado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | RESOURCE_CONFLICT | Código já existente no escopo. | Consultar recurso e corrigir código. |
| 409 | GOVERNANCE_FRAMEWORK_ARCHIVED | Framework arquivado. | Selecionar definição editável. |
| 409 | GOVERNANCE_FRAMEWORK_EMPTY | Framework ACTIVE precisa de controles ativos. | Ativar/manter ao menos um controle. |
| 409 | GOVERNANCE_STATE_INVALID | Transição de estado não permitida. | Reconsultar estado e corrigir fluxo. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/assessments

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceAssessments`. Registros consultados com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |
| query | frameworkId | string / uuid | não | Ver regras de negócio no contrato. |
| query | status | enum DRAFT, IN_PROGRESS, CLOSED, ALL | não | Ver regras de negócio no contrato. |

Sort permitido: name/assessmentDate/createdAt/closedAt; padrão assessmentDate,asc. Desempate UUID asc. q busca literal em name. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": [
    {
      "id": "00000006-0006-4006-8006-000000000006",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "name": "Avaliação interna",
      "status": "IN_PROGRESS",
      "assessmentDate": "2026-10-03",
      "frameworkSnapshot": {
        "id": "00000003-0003-4003-8003-000000000003",
        "code": "QA",
        "name": "Política interna",
        "versionLabel": "1.0",
        "version": 4,
        "description": null,
        "sections": [
          {
            "id": "00000004-0004-4004-8004-000000000004",
            "workspaceId": "00000001-0001-4001-8001-000000000001",
            "frameworkId": "00000003-0003-4003-8003-000000000003",
            "parentSectionId": null,
            "code": "POL",
            "name": "Política",
            "description": null,
            "position": 1
          }
        ]
      },
      "closedAt": null,
      "createdBy": "00000012-0012-4012-8012-000000000012",
      "version": 3,
      "createdAt": "2026-10-03T09:00:00.000-03:00",
      "updatedAt": "2026-10-03T09:00:00.000-03:00",
      "index": {
        "value": 100,
        "numerator": 300,
        "denominator": 3,
        "assessedControls": 1,
        "totalControls": 1
      },
      "indicatorType": "INTERNAL"
    }
  ],
  "message": "Registros consultados com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/assessments

### Objetivo e acesso

**OpenAPI operationId:** `createGovernanceAssessment`. Registro criado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.assess**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | frameworkId | string / uuid | sim | Ver regras de negócio no contrato. |
| body | name | string | sim | mín. caracteres 1; máx. caracteres 100 |
| body | assessmentDate | string / date | sim | data real YYYY-MM-DD, 1000–9999 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "frameworkId": "00000003-0003-4003-8003-000000000003",
  "name": "Avaliação interna",
  "assessmentDate": "2026-10-03"
}
```

### Respostas de sucesso

HTTP **201**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Location aponta recurso criado; seções/controles apontam coleção filha. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "DRAFT",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 1,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 0,
      "numerator": 0,
      "denominator": 3,
      "assessedControls": 0,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Registro criado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_FRAMEWORK_INACTIVE | Framework fora de ACTIVE. | Selecionar/ativar framework. |
| 409 | GOVERNANCE_FRAMEWORK_EMPTY | Framework ACTIVE precisa de controles ativos. | Ativar/manter ao menos um controle. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/assessments/{id}

### Objetivo e acesso

**OpenAPI operationId:** `getGovernanceAssessment`. Registro consultado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |

Não aceita query; enviar GET sem body.

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "IN_PROGRESS",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 3,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 100,
      "numerator": 300,
      "denominator": 3,
      "assessedControls": 1,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Registro consultado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/goals

Atualização 04/10/2026: contratos de sectionId/ownerMemberId, nomes públicos e resultado histórico detalhados em [metas por seção](framework-progress.md#extensão-dos-endpoints-de-metas-existentes). Esta rota mantém acesso/envelope/versionamento; leituras e mutações retornam os novos campos descritos no guia. Criação/edição aceitam os dois IDs opcionais/nulos; cálculo permanece explícito e na última CLOSED.

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceGoals`. Registros consultados com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |
| query | projectId | string / uuid | não | Ver regras de negócio no contrato. |
| query | status | enum ACTIVE, ACHIEVED, MISSED, CANCELLED, ALL | não | Ver regras de negócio no contrato. |

Sort permitido: name/deadline/createdAt/updatedAt; padrão name,asc. Desempate UUID asc. q busca literal em name. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals?page=1&size=20
Authorization: Bearer <accessToken>
```

Conclusão da meta: `actionProgress` atual e status por ações/prazo, independentes
do valor da métrica. Meta sem ações válidas não é atingida. GET não grava dados;
as listas filtram o status derivado antes de contar/paginar. Consulte
[regras e fluxo do front](goal-action-completion.md).

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceGoalResponse](governance-contracts.md#governancegoalresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000009-0009-4009-8009-000000000009",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "projectId": "00000002-0002-4002-8002-000000000002",
      "frameworkId": null,
      "name": "Cobertura de automação",
      "description": null,
      "goalType": "AUTOMATION_COVERAGE",
      "operator": "GTE",
      "targetValue": 80,
      "deadline": "2026-12-31",
      "status": "ACTIVE",
      "lastResult": null,
      "createdBy": "00000012-0012-4012-8012-000000000012",
      "version": 1,
      "createdAt": "2026-10-03T09:00:00.000-03:00",
      "updatedAt": "2026-10-03T09:00:00.000-03:00",
      "sectionId": null,
      "ownerMemberId": null,
      "sectionName": null,
      "sectionPath": [],
      "ownerDisplayName": null,
      "actionProgress": {
        "basis": "ACTIONS",
        "totalActions": 0,
        "completedActions": 0,
        "cancelledActions": 0,
        "percent": null
      }
    }
  ],
  "message": "Registros consultados com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/goals

Atualização 04/10/2026: contratos de sectionId/ownerMemberId, nomes públicos e resultado histórico detalhados em [metas por seção](framework-progress.md#extensão-dos-endpoints-de-metas-existentes). Esta rota mantém acesso/envelope/versionamento; leituras e mutações retornam os novos campos descritos no guia. Criação/edição aceitam os dois IDs opcionais/nulos; cálculo permanece explícito e na última CLOSED.

### Objetivo e acesso

**OpenAPI operationId:** `createGovernanceGoal`. Registro criado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | projectId | string / uuid | não | aceita null |
| body | frameworkId | string / uuid | não | aceita null |
| body | name | string | sim | mín. caracteres 1; máx. caracteres 100 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | goalType | enum AUTOMATION_COVERAGE, CRITICAL_DEFECTS, GOVERNANCE_SCORE | sim | Ver regras de negócio no contrato. |
| body | operator | enum GT, GTE, EQ, LTE, LT | sim | Ver regras de negócio no contrato. |
| body | targetValue | number | sim | mínimo 0; máximo 1000000000 |
| body | deadline | string / date | não | aceita null; data real YYYY-MM-DD, 1000–9999 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "projectId": "00000002-0002-4002-8002-000000000002",
  "name": "Cobertura de automação",
  "goalType": "AUTOMATION_COVERAGE",
  "operator": "GTE",
  "targetValue": 80,
  "deadline": "2026-12-31"
}
```

Conclusão da meta: `actionProgress` atual e status por ações/prazo, independentes
do valor da métrica. Meta sem ações válidas não é atingida. GET não grava dados;
as listas filtram o status derivado antes de contar/paginar. Consulte
[regras e fluxo do front](goal-action-completion.md).

### Respostas de sucesso

HTTP **201**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Location aponta recurso criado; seções/controles apontam coleção filha. Campos de data: [GovernanceGoalResponse](governance-contracts.md#governancegoalresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000009-0009-4009-8009-000000000009",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "projectId": "00000002-0002-4002-8002-000000000002",
    "frameworkId": null,
    "name": "Cobertura de automação",
    "description": null,
    "goalType": "AUTOMATION_COVERAGE",
    "operator": "GTE",
    "targetValue": 80,
    "deadline": "2026-12-31",
    "status": "ACTIVE",
    "lastResult": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 1,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "sectionId": null,
    "ownerMemberId": null,
    "sectionName": null,
    "sectionPath": [],
    "ownerDisplayName": null,
    "actionProgress": {
      "basis": "ACTIONS",
      "totalActions": 0,
      "completedActions": 0,
      "cancelledActions": 0,
      "percent": null
    }
  },
  "message": "Registro criado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado impede escrita/cálculo. | Usar projeto ativo ou consultar histórico. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/goals/{id}

Atualização 04/10/2026: contratos de sectionId/ownerMemberId, nomes públicos e resultado histórico detalhados em [metas por seção](framework-progress.md#extensão-dos-endpoints-de-metas-existentes). Esta rota mantém acesso/envelope/versionamento; leituras e mutações retornam os novos campos descritos no guia. Criação/edição aceitam os dois IDs opcionais/nulos; cálculo permanece explícito e na última CLOSED.

### Objetivo e acesso

**OpenAPI operationId:** `getGovernanceGoal`. Registro consultado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |

Não aceita query; enviar GET sem body.

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals/00000009-0009-4009-8009-000000000009
Authorization: Bearer <accessToken>
```

Conclusão da meta: `actionProgress` atual e status por ações/prazo, independentes
do valor da métrica. Meta sem ações válidas não é atingida. GET não grava dados;
as listas filtram o status derivado antes de contar/paginar. Consulte
[regras e fluxo do front](goal-action-completion.md).

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceGoalResponse](governance-contracts.md#governancegoalresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000009-0009-4009-8009-000000000009",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "projectId": "00000002-0002-4002-8002-000000000002",
    "frameworkId": null,
    "name": "Cobertura de automação",
    "description": null,
    "goalType": "AUTOMATION_COVERAGE",
    "operator": "GTE",
    "targetValue": 80,
    "deadline": "2026-12-31",
    "status": "ACTIVE",
    "lastResult": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 1,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "sectionId": null,
    "ownerMemberId": null,
    "sectionName": null,
    "sectionPath": [],
    "ownerDisplayName": null,
    "actionProgress": {
      "basis": "ACTIONS",
      "totalActions": 0,
      "completedActions": 0,
      "cancelledActions": 0,
      "percent": null
    }
  },
  "message": "Registro consultado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals/00000009-0009-4009-8009-000000000009",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## PATCH /api/v1/workspaces/{workspaceId}/governance/goals/{id}

Atualização 04/10/2026: contratos de sectionId/ownerMemberId, nomes públicos e resultado histórico detalhados em [metas por seção](framework-progress.md#extensão-dos-endpoints-de-metas-existentes). Esta rota mantém acesso/envelope/versionamento; leituras e mutações retornam os novos campos descritos no guia. Criação/edição aceitam os dois IDs opcionais/nulos; cálculo permanece explícito e na última CLOSED.

### Objetivo e acesso

**OpenAPI operationId:** `updateGovernanceGoal`. Registro atualizado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | projectId | string / uuid | não | aceita null |
| body | frameworkId | string / uuid | não | aceita null |
| body | name | string | não | mín. caracteres 1; máx. caracteres 100 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | goalType | enum AUTOMATION_COVERAGE, CRITICAL_DEFECTS, GOVERNANCE_SCORE | não | Ver regras de negócio no contrato. |
| body | operator | enum GT, GTE, EQ, LTE, LT | não | Ver regras de negócio no contrato. |
| body | targetValue | number | não | mínimo 0; máximo 1000000000 |
| body | deadline | string / date | não | aceita null; data real YYYY-MM-DD, 1000–9999 |
| body | status | enum ACTIVE, CANCELLED | não | Ver regras de negócio no contrato. |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
PATCH /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals/00000009-0009-4009-8009-000000000009
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 2,
  "targetValue": 90
}
```

Conclusão da meta: `actionProgress` atual e status por ações/prazo, independentes
do valor da métrica. Meta sem ações válidas não é atingida. GET não grava dados;
as listas filtram o status derivado antes de contar/paginar. Consulte
[regras e fluxo do front](goal-action-completion.md).

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceGoalResponse](governance-contracts.md#governancegoalresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000009-0009-4009-8009-000000000009",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "projectId": "00000002-0002-4002-8002-000000000002",
    "frameworkId": null,
    "name": "Cobertura de automação",
    "description": null,
    "goalType": "AUTOMATION_COVERAGE",
    "operator": "GTE",
    "targetValue": 90,
    "deadline": "2026-12-31",
    "status": "ACTIVE",
    "lastResult": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 3,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "sectionId": null,
    "ownerMemberId": null,
    "sectionName": null,
    "sectionPath": [],
    "ownerDisplayName": null,
    "actionProgress": {
      "basis": "ACTIONS",
      "totalActions": 0,
      "completedActions": 0,
      "cancelledActions": 0,
      "percent": null
    }
  },
  "message": "Registro atualizado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_GOAL_CANCELLED | Meta cancelada. | Cancelar edição/cálculo; estado terminal. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado impede escrita/cálculo. | Usar projeto ativo ou consultar histórico. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals/00000009-0009-4009-8009-000000000009",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/actions

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceActions`. Registros consultados com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |
| query | goalId | string / uuid | não | Ver regras de negócio no contrato. |
| query | controlAssessmentId | string / uuid | não | Ver regras de negócio no contrato. |
| query | status | enum OPEN, IN_PROGRESS, DONE, CANCELLED, ALL | não | Ver regras de negócio no contrato. |

Sort permitido: title/dueDate/createdAt/updatedAt; padrão dueDate,asc. Desempate UUID asc. q busca literal em title. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [ActionPlanResponse](governance-contracts.md#actionplanresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000010-0010-4010-8010-000000000010",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
      "goalId": null,
      "title": "Formalizar aprovação",
      "description": null,
      "ownerMemberId": "00000011-0011-4011-8011-000000000011",
      "status": "OPEN",
      "dueDate": "2026-12-31",
      "completedAt": null,
      "createdBy": "00000012-0012-4012-8012-000000000012",
      "version": 1,
      "createdAt": "2026-10-03T09:00:00.000-03:00",
      "updatedAt": "2026-10-03T09:00:00.000-03:00"
    }
  ],
  "message": "Registros consultados com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/actions

### Objetivo e acesso

**OpenAPI operationId:** `createGovernanceAction`. Registro criado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | controlAssessmentId | string / uuid | não | aceita null |
| body | goalId | string / uuid | não | aceita null |
| body | title | string | sim | mín. caracteres 1; máx. caracteres 250 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | ownerMemberId | string / uuid | não | aceita null |
| body | dueDate | string / date | não | aceita null; data real YYYY-MM-DD, 1000–9999 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
  "title": "Formalizar aprovação",
  "ownerMemberId": "00000011-0011-4011-8011-000000000011",
  "dueDate": "2026-12-31"
}
```

Metas vinculadas usam conclusão por ações. Criar/concluir ações atualiza a
situação e a versão da meta na mesma transação; reconsultar a meta após sucesso.
GET dashboard apenas agrega contagens atuais, sem gravação. Frameworks e
avaliações não são alterados. [Contrato](goal-action-completion.md).

### Respostas de sucesso

HTTP **201**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Location aponta recurso criado; seções/controles apontam coleção filha. Campos de data: [ActionPlanResponse](governance-contracts.md#actionplanresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000010-0010-4010-8010-000000000010",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
    "goalId": null,
    "title": "Formalizar aprovação",
    "description": null,
    "ownerMemberId": "00000011-0011-4011-8011-000000000011",
    "status": "OPEN",
    "dueDate": "2026-12-31",
    "completedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 1,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Registro criado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado impede escrita/cálculo. | Usar projeto ativo ou consultar histórico. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/actions/{id}

### Objetivo e acesso

**OpenAPI operationId:** `getGovernanceAction`. Registro consultado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |

Não aceita query; enviar GET sem body.

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions/00000010-0010-4010-8010-000000000010
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [ActionPlanResponse](governance-contracts.md#actionplanresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000010-0010-4010-8010-000000000010",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
    "goalId": null,
    "title": "Formalizar aprovação",
    "description": null,
    "ownerMemberId": "00000011-0011-4011-8011-000000000011",
    "status": "OPEN",
    "dueDate": "2026-12-31",
    "completedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 1,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Registro consultado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions/00000010-0010-4010-8010-000000000010",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## PATCH /api/v1/workspaces/{workspaceId}/governance/actions/{id}

### Objetivo e acesso

**OpenAPI operationId:** `updateGovernanceAction`. Registro atualizado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

Desde 07/10/2026 esta rota também permite associar uma ação já cadastrada a uma
meta. Origem/destino pertencem ao mesmo Workspace e devem ser acessíveis pelo
usuário; projetos vinculados precisam estar ativos. Ação DONE/CANCELLED não aceita
edição. Não permite vincular a uma meta CANCELLED; uma meta já vinculada cancelada
não impede evolução/remoção da associação. Preserva controlAssessmentId.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | goalId | string / UUID v4 ou null | não | Ausente mantém; UUID associa/troca a meta; null remove. |
| body | title | string | não | mín. caracteres 1; máx. caracteres 250 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | ownerMemberId | string / uuid | não | aceita null |
| body | dueDate | string / date | não | aceita null; data real YYYY-MM-DD, 1000–9999 |
| body | status | enum OPEN, IN_PROGRESS, CANCELLED | não | Ver regras de negócio no contrato. |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
PATCH /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions/00000010-0010-4010-8010-000000000010
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 1,
  "goalId": "00000009-0009-4009-8009-000000000009"
}
```

Para trocar a meta, enviar outro goalId e a versão atual da ação. Para remover:

```json
{
  "version": 2,
  "goalId": null
}
```

goalId omitido mantém a associação existente, inclusive ao mudar status/título.
A versão enviada é da ação. Não enviar controlAssessmentId: campo imutável.

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [ActionPlanResponse](governance-contracts.md#actionplanresponse);
null explícito e dados de ator/data vêm do servidor. Cada atualização incrementa
version e updatedAt da ação e grava auditoria governance.action.updated de forma
atômica. LastResult e avaliação permanecem iguais; status/version/updatedAt das metas
afetadas são atualizados automaticamente pela conclusão das ações. O vínculo passa a ser retornado em GET/listas/dashboard
conforme o acesso atual; a ação pode deixar de ser visível a outros usuários
quando associada a uma meta de projeto privado.

```json
{
  "data": {
    "id": "00000010-0010-4010-8010-000000000010",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
    "goalId": "00000009-0009-4009-8009-000000000009",
    "title": "Formalizar aprovação",
    "description": null,
    "ownerMemberId": "00000011-0011-4011-8011-000000000011",
    "status": "OPEN",
    "dueDate": "2026-12-31",
    "completedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 2,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Registro atualizado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_GOAL_CANCELLED | Meta de destino CANCELLED. | Escolher uma meta não cancelada. |
| 409 | GOVERNANCE_ACTION_TERMINAL | Ação DONE/CANCELLED. | Consultar resultado; estado terminal. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado impede escrita/cálculo. | Usar projeto ativo ou consultar histórico. |
| 409 | GOVERNANCE_STATE_INVALID | Transição de estado não permitida. | Reconsultar estado e corrigir fluxo. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions/00000010-0010-4010-8010-000000000010",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Na Meta, consultar `GET .../governance/actions?goalId={goalId}` para a lista
   vinculada. Para selecionar uma ação existente, usar a listagem de ações
   do mesmo Workspace e suas páginas; ações OPEN/IN_PROGRESS podem ser editadas.
   O campo goalId informa o vínculo atual; avisar quando a escolha trocar a meta.
2. Ler a versão atual da ação por `GET .../governance/actions/{id}` e enviar
   `PATCH .../governance/actions/{id}` com version e goalId da meta escolhida.
   Quando o fluxo partir da Ação, escolher a meta nas listas de metas acessíveis.
3. Aplicar a ActionPlanResponse e sua nova versão. Reconsultar a meta e as listas
   de origem/destino, da ação e o dashboard: as metas também recebem nova versão.
   Não chamar calculate para atualizar conclusão; lastResult é informativo.
   O usuário precisa de governance.read para as consultas e governance.manage
   para a escrita, além do acesso à ação/meta/projeto.
4. Para desvincular, enviar goalId null com a versão atual. Em 409, consultar
   estado/versão antes de conciliar; em timeout/rede, confirmar o goalId pelo
   GET antes de tentar novamente. Limpar cache na troca de Workspace/logout.

Os [fluxos e regras](governance-contracts.md) detalham snapshots e autorização.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** extensão aditiva em 07/10/2026 de endpoint existente da Fase 06.
- **Impacto:** goalId passa a ser aceito no PATCH. Clientes que não o enviam preservam o comportamento anterior; sem novos grants ou campos de resposta.
- **Migração:** nenhuma nova migration; goal_id e FK composta já existem. Sem nova rota.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}/sections

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceSections`. Definições consultadas com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |

Sort permitido: position/code/name; padrão position,asc. Desempate UUID asc. q busca literal em code/name. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/sections?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [FrameworkSectionResponse](governance-contracts.md#frameworksectionresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000004-0004-4004-8004-000000000004",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "parentSectionId": null,
      "code": "POL",
      "name": "Política",
      "description": null,
      "position": 1
    }
  ],
  "message": "Definições consultadas com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/sections",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}/sections

### Objetivo e acesso

**OpenAPI operationId:** `createGovernanceSection`. Definição criada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | code | string | sim | mín. caracteres 1; máx. caracteres 50 |
| body | name | string | sim | mín. caracteres 1; máx. caracteres 100 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | parentSectionId | string / uuid | não | aceita null |
| body | position | number | sim | mínimo 1; máximo 1000000 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/sections
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 1,
  "code": "POL",
  "name": "Política",
  "description": null,
  "parentSectionId": null,
  "position": 1
}
```

### Respostas de sucesso

HTTP **201**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Location aponta recurso criado; seções/controles apontam coleção filha. Campos de data: [SectionMutationResponse](governance-contracts.md#sectionmutationresponse);
null explícito e dados de ator/data vêm do servidor.
Atualizar versão do Framework com frameworkVersion da resposta.

```json
{
  "data": {
    "section": {
      "id": "00000004-0004-4004-8004-000000000004",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "parentSectionId": null,
      "code": "POL",
      "name": "Política",
      "description": null,
      "position": 1
    },
    "frameworkVersion": 2
  },
  "message": "Definição criada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | RESOURCE_CONFLICT | Código já existente no escopo. | Consultar recurso e corrigir código. |
| 409 | GOVERNANCE_FRAMEWORK_ARCHIVED | Framework arquivado. | Selecionar definição editável. |
| 409 | GOVERNANCE_SECTION_CYCLE / GOVERNANCE_SECTION_DEPTH | Árvore cíclica ou mais de 20 níveis. | Corrigir pai/árvore. |
| 409 | GOVERNANCE_LIMIT | Mais de 500 seções. | Reduzir vínculos/definições antes de adicionar. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/sections",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## PATCH /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}/sections/{childId}

### Objetivo e acesso

**OpenAPI operationId:** `updateGovernanceSection`. Definição atualizada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | childId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | code | string | não | mín. caracteres 1; máx. caracteres 50 |
| body | name | string | não | mín. caracteres 1; máx. caracteres 100 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | parentSectionId | string / uuid | não | aceita null |
| body | position | number | não | mínimo 1; máximo 1000000 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
PATCH /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/sections/00000004-0004-4004-8004-000000000004
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 4,
  "name": "Política e estratégia"
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [SectionMutationResponse](governance-contracts.md#sectionmutationresponse);
null explícito e dados de ator/data vêm do servidor.
Atualizar versão do Framework com frameworkVersion da resposta.

```json
{
  "data": {
    "section": {
      "id": "00000004-0004-4004-8004-000000000004",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "parentSectionId": null,
      "code": "POL",
      "name": "Política e estratégia",
      "description": null,
      "position": 1
    },
    "frameworkVersion": 5
  },
  "message": "Definição atualizada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | RESOURCE_CONFLICT | Código já existente no escopo. | Consultar recurso e corrigir código. |
| 409 | GOVERNANCE_FRAMEWORK_ARCHIVED | Framework arquivado. | Selecionar definição editável. |
| 409 | GOVERNANCE_SECTION_CYCLE / GOVERNANCE_SECTION_DEPTH | Árvore cíclica ou mais de 20 níveis. | Corrigir pai/árvore. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/sections/00000004-0004-4004-8004-000000000004",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}/controls

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceControls`. Definições consultadas com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |
| query | active | boolean | não | Ver regras de negócio no contrato. |
| query | sectionId | string / uuid | não | Ver regras de negócio no contrato. |

Sort permitido: creationOrder/code/title; padrão creationOrder,asc. creationOrder é inteiro técnico imutável, atribuído pelo banco. Desempate UUID asc. q busca literal em code/title. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/controls?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceControlResponse](governance-contracts.md#governancecontrolresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000005-0005-4005-8005-000000000005",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "sectionId": "00000004-0004-4004-8004-000000000004",
      "code": "POL-1",
      "title": "Política aprovada",
      "description": null,
      "weight": 3,
      "active": true
    }
  ],
  "message": "Definições consultadas com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/controls",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}/controls

### Objetivo e acesso

**OpenAPI operationId:** `createGovernanceControl`. Definição criada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | sectionId | string / uuid | sim | Ver regras de negócio no contrato. |
| body | code | string | sim | mín. caracteres 1; máx. caracteres 50 |
| body | title | string | sim | mín. caracteres 1; máx. caracteres 250 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | weight | number | não | mínimo 1; máximo 1000 |
| body | active | boolean | não | Ver regras de negócio no contrato. |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/controls
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 2,
  "sectionId": "00000004-0004-4004-8004-000000000004",
  "code": "POL-1",
  "title": "Política aprovada",
  "weight": 3,
  "active": true
}
```

### Respostas de sucesso

HTTP **201**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Location aponta recurso criado; seções/controles apontam coleção filha. Campos de data: [ControlMutationResponse](governance-contracts.md#controlmutationresponse);
null explícito e dados de ator/data vêm do servidor.
Atualizar versão do Framework com frameworkVersion da resposta.

```json
{
  "data": {
    "control": {
      "id": "00000005-0005-4005-8005-000000000005",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "sectionId": "00000004-0004-4004-8004-000000000004",
      "code": "POL-1",
      "title": "Política aprovada",
      "description": null,
      "weight": 3,
      "active": true
    },
    "frameworkVersion": 3
  },
  "message": "Definição criada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | RESOURCE_CONFLICT | Código já existente no escopo. | Consultar recurso e corrigir código. |
| 409 | GOVERNANCE_FRAMEWORK_ARCHIVED | Framework arquivado. | Selecionar definição editável. |
| 409 | GOVERNANCE_FRAMEWORK_EMPTY | Framework ACTIVE precisa de controles ativos. | Ativar/manter ao menos um controle. |
| 409 | GOVERNANCE_LIMIT | Mais de 1000 controles. | Reduzir vínculos/definições antes de adicionar. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/controls",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## PATCH /api/v1/workspaces/{workspaceId}/governance/frameworks/{id}/controls/{childId}

### Objetivo e acesso

**OpenAPI operationId:** `updateGovernanceControl`. Definição atualizada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Definições ARCHIVED não aceitam escrita; árvore sem ciclos e avaliações já criadas preservam cópias.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | childId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | sectionId | string / uuid | não | Ver regras de negócio no contrato. |
| body | code | string | não | mín. caracteres 1; máx. caracteres 50 |
| body | title | string | não | mín. caracteres 1; máx. caracteres 250 |
| body | description | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |
| body | weight | number | não | mínimo 1; máximo 1000 |
| body | active | boolean | não | Ver regras de negócio no contrato. |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
PATCH /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/controls/00000005-0005-4005-8005-000000000005
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 4,
  "title": "Política revisada"
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [ControlMutationResponse](governance-contracts.md#controlmutationresponse);
null explícito e dados de ator/data vêm do servidor.
Atualizar versão do Framework com frameworkVersion da resposta.

```json
{
  "data": {
    "control": {
      "id": "00000005-0005-4005-8005-000000000005",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "sectionId": "00000004-0004-4004-8004-000000000004",
      "code": "POL-1",
      "title": "Política revisada",
      "description": null,
      "weight": 3,
      "active": true
    },
    "frameworkVersion": 5
  },
  "message": "Definição atualizada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | RESOURCE_CONFLICT | Código já existente no escopo. | Consultar recurso e corrigir código. |
| 409 | GOVERNANCE_FRAMEWORK_ARCHIVED | Framework arquivado. | Selecionar definição editável. |
| 409 | GOVERNANCE_FRAMEWORK_EMPTY | Framework ACTIVE precisa de controles ativos. | Ativar/manter ao menos um controle. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/frameworks/00000003-0003-4003-8003-000000000003/controls/00000005-0005-4005-8005-000000000005",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/start

### Objetivo e acesso

**OpenAPI operationId:** `startGovernanceAssessment`. Avaliação iniciada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.assess**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/start
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "IN_PROGRESS",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 2,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 0,
      "numerator": 0,
      "denominator": 3,
      "assessedControls": 0,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Avaliação iniciada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_STATE_INVALID | Transição de estado não permitida. | Reconsultar estado e corrigir fluxo. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/start",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/controls

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceControlAssessments`. Controles avaliados consultados com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | status | enum NOT_ASSESSED, NOT_MET, PARTIALLY_MET, MET, NOT_APPLICABLE, ALL | não | Ver regras de negócio no contrato. |

Sort permitido: controlId/assessedAt; padrão controlId,asc. Desempate UUID asc. Não aceita q. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [ControlAssessmentResponse](governance-contracts.md#controlassessmentresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000007-0007-4007-8007-000000000007",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "frameworkId": "00000003-0003-4003-8003-000000000003",
      "assessmentId": "00000006-0006-4006-8006-000000000006",
      "controlId": "00000005-0005-4005-8005-000000000005",
      "controlSnapshot": {
        "id": "00000005-0005-4005-8005-000000000005",
        "sectionId": "00000004-0004-4004-8004-000000000004",
        "code": "POL-1",
        "title": "Política aprovada",
        "description": null,
        "weight": 3,
        "sectionPath": [
          {
            "id": "00000004-0004-4004-8004-000000000004",
            "code": "POL",
            "name": "Política"
          }
        ]
      },
      "status": "MET",
      "score": 100,
      "justification": "Política aprovada pela equipe.",
      "assessedBy": "00000012-0012-4012-8012-000000000012",
      "assessedAt": "2026-10-03T09:00:00.000-03:00"
    }
  ],
  "message": "Controles avaliados consultados com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## PUT /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}

### Objetivo e acesso

**OpenAPI operationId:** `assessGovernanceControl`. Controle avaliado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.assess**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | controlId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | status | enum NOT_ASSESSED, NOT_MET, PARTIALLY_MET, MET, NOT_APPLICABLE | sim | Ver regras de negócio no contrato. |
| body | justification | string | não | mín. caracteres 0; máx. caracteres 10000; aceita null |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
PUT /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 2,
  "status": "MET",
  "justification": "Política aprovada pela equipe."
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "IN_PROGRESS",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 3,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 100,
      "numerator": 300,
      "denominator": 3,
      "assessedControls": 1,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Controle avaliado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_ASSESSMENT_LOCKED | Avaliação fora de IN_PROGRESS. | Reconsultar avaliação; CLOSED é terminal. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}/evidence

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceEvidence`. Evidências consultadas com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Arquivos exigem também attachment.read para inclusão e para leitura quando o controle possui arquivo. Apenas IN_PROGRESS permite alteração; CLOSED preserva links.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | controlId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| query | page | number | não | mínimo 1; máximo 100000; padrão 1 |
| query | size | number | não | mínimo 1; máximo 100; padrão 20 |
| query | sort | string | não | Ver regras de negócio no contrato. |
| query | q | string | não | máx. caracteres 100 |

Sort permitido: createdAt/title/validUntil; padrão createdAt,asc. Desempate UUID asc. q busca literal em title. Filtros precedem paginação e total. Lista vazia 200/data=[].

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005/evidence?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [EvidenceLinkResponse](governance-contracts.md#evidencelinkresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": [
    {
      "id": "00000008-0008-4008-8008-000000000008",
      "workspaceId": "00000001-0001-4001-8001-000000000001",
      "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
      "evidenceType": "URL",
      "referenceId": null,
      "url": "https://example.com/policy",
      "title": "Política aprovada",
      "validUntil": "2026-12-31",
      "attachmentSnapshot": null,
      "createdBy": "00000012-0012-4012-8012-000000000012",
      "createdAt": "2026-10-03T09:00:00.000-03:00",
      "attachmentAvailable": null
    }
  ],
  "message": "Evidências consultadas com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00",
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

Sem resultados: data=[], meta.pagination com totalItems=0, totalPages=0 e hasNext/hasPrevious=false.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005/evidence",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}/evidence

### Objetivo e acesso

**OpenAPI operationId:** `addGovernanceEvidence`. Evidência adicionada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.assess**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Arquivos exigem também attachment.read para inclusão e para leitura quando o controle possui arquivo. Apenas IN_PROGRESS permite alteração; CLOSED preserva links.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | controlId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |
| body | evidenceType | enum ATTACHMENT, URL | sim | Ver regras de negócio no contrato. |
| body | referenceId | string / uuid | não | aceita null |
| body | url | string | não | mín. caracteres 0; máx. caracteres 2048; aceita null |
| body | title | string | sim | mín. caracteres 1; máx. caracteres 250 |
| body | validUntil | string / date | não | aceita null; data real YYYY-MM-DD, 1000–9999 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005/evidence
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 3,
  "evidenceType": "URL",
  "url": "https://example.com/policy",
  "title": "Política aprovada",
  "validUntil": "2026-12-31"
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "IN_PROGRESS",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 4,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 100,
      "numerator": 300,
      "denominator": 3,
      "assessedControls": 1,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Evidência adicionada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_ASSESSMENT_LOCKED | Avaliação fora de IN_PROGRESS. | Reconsultar avaliação; CLOSED é terminal. |
| 409 | GOVERNANCE_LIMIT | Mais de 100 evidências por controle. | Reduzir vínculos/definições antes de adicionar. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005/evidence",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## DELETE /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/controls/{controlId}/evidence/{evidenceId}

### Objetivo e acesso

**OpenAPI operationId:** `removeGovernanceEvidence`. Evidência removida com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.assess**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Arquivos exigem também attachment.read para inclusão e para leitura quando o controle possui arquivo. Apenas IN_PROGRESS permite alteração; CLOSED preserva links.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | controlId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | evidenceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
DELETE /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005/evidence/00000008-0008-4008-8008-000000000008
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 4
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "IN_PROGRESS",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": null,
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 5,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 100,
      "numerator": 300,
      "denominator": 3,
      "assessedControls": 1,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Evidência removida com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_ASSESSMENT_LOCKED | Avaliação fora de IN_PROGRESS. | Reconsultar avaliação; CLOSED é terminal. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/controls/00000005-0005-4005-8005-000000000005/evidence/00000008-0008-4008-8008-000000000008",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/assessments/{id}/close

### Objetivo e acesso

**OpenAPI operationId:** `closeGovernanceAssessment`. Avaliação fechada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.assess**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/close
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 3
}
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [AssessmentResponse](governance-contracts.md#assessmentresponse);
null explícito e dados de ator/data vêm do servidor.
Snapshot preservado; index é interno derivado, sem certificação oficial. Alteração devolve versão atualizada de Assessment.

```json
{
  "data": {
    "id": "00000006-0006-4006-8006-000000000006",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "frameworkId": "00000003-0003-4003-8003-000000000003",
    "name": "Avaliação interna",
    "status": "CLOSED",
    "assessmentDate": "2026-10-03",
    "frameworkSnapshot": {
      "id": "00000003-0003-4003-8003-000000000003",
      "code": "QA",
      "name": "Política interna",
      "versionLabel": "1.0",
      "version": 4,
      "description": null,
      "sections": [
        {
          "id": "00000004-0004-4004-8004-000000000004",
          "workspaceId": "00000001-0001-4001-8001-000000000001",
          "frameworkId": "00000003-0003-4003-8003-000000000003",
          "parentSectionId": null,
          "code": "POL",
          "name": "Política",
          "description": null,
          "position": 1
        }
      ]
    },
    "closedAt": "2026-10-03T09:00:00.000-03:00",
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 4,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "index": {
      "value": 100,
      "numerator": 300,
      "denominator": 3,
      "assessedControls": 1,
      "totalControls": 1
    },
    "indicatorType": "INTERNAL"
  },
  "message": "Avaliação fechada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_ASSESSMENT_LOCKED | Avaliação fora de IN_PROGRESS. | Reconsultar avaliação; CLOSED é terminal. |
| 409 | GOVERNANCE_ASSESSMENT_INCOMPLETE | Controles não classificados ou N/A sem justificativa. | Concluir avaliação antes de fechar. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/assessments/00000006-0006-4006-8006-000000000006/close",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/goals/{id}/calculate

Atualização 04/10/2026: contratos de sectionId/ownerMemberId, nomes públicos e resultado histórico detalhados em [metas por seção](framework-progress.md#extensão-dos-endpoints-de-metas-existentes). Esta rota mantém acesso/envelope/versionamento; leituras e mutações retornam os novos campos descritos no guia. Criação/edição aceitam os dois IDs opcionais/nulos; cálculo permanece explícito e na última CLOSED.

### Objetivo e acesso

**OpenAPI operationId:** `calculateGovernanceGoal`. Meta calculada com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).
Cálculo exige leitura da fonte em cada Projeto; grava resultado/instante/fontes e estado. Não recalcula automaticamente em GET.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals/00000009-0009-4009-8009-000000000009/calculate
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 1
}
```

Conclusão da meta: `actionProgress` atual e status por ações/prazo, independentes
do valor da métrica. Meta sem ações válidas não é atingida. GET não grava dados;
as listas filtram o status derivado antes de contar/paginar. Consulte
[regras e fluxo do front](goal-action-completion.md).

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [GovernanceGoalResponse](governance-contracts.md#governancegoalresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000009-0009-4009-8009-000000000009",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "projectId": "00000002-0002-4002-8002-000000000002",
    "frameworkId": null,
    "name": "Cobertura de automação",
    "description": null,
    "goalType": "AUTOMATION_COVERAGE",
    "operator": "GTE",
    "targetValue": 80,
    "deadline": "2026-12-31",
    "status": "ACTIVE",
    "lastResult": {
      "value": 50,
      "numerator": 1,
      "denominator": 2,
      "calculatedAt": "2026-10-03T09:00:00.000-03:00",
      "sourceIds": [
        "00000002-0002-4002-8002-000000000002"
      ]
    },
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 2,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00",
    "sectionId": null,
    "ownerMemberId": null,
    "sectionName": null,
    "sectionPath": [],
    "ownerDisplayName": null,
    "actionProgress": {
      "basis": "ACTIONS",
      "totalActions": 0,
      "completedActions": 0,
      "cancelledActions": 0,
      "percent": null
    }
  },
  "message": "Meta calculada com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_GOAL_CANCELLED | Meta cancelada. | Cancelar edição/cálculo; estado terminal. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado impede escrita/cálculo. | Usar projeto ativo ou consultar histórico. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/goals/00000009-0009-4009-8009-000000000009/calculate",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## POST /api/v1/workspaces/{workspaceId}/governance/actions/{id}/complete

### Objetivo e acesso

**OpenAPI operationId:** `completeGovernanceAction`. Ação concluída com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.manage**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.
Escopo de Projeto exige visibilidade; escrita exige Projeto ativo. Metas de Workspace verificam todas as fontes e histórico conforme [acesso](governance-contracts.md#acesso-e-compatibilidade).

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| header | Content-Type | application/json | sim | JSON até 32 KiB; sem query. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| rota | id | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |
| body | version | number | sim | mínimo 1; máximo 2147483647 |

Ausente mantém no PATCH, campos nullable aceitam null; required não aceita null. version é do Framework para definições filhas, Assessment para resultado/evidência, ou do Goal/ActionPlan nos respectivos endpoints. As combinações e estados seguem o [contrato](governance-contracts.md).

```http
POST /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions/00000010-0010-4010-8010-000000000010/complete
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "version": 2
}
```

Metas vinculadas usam conclusão por ações. Criar/concluir ações atualiza a
situação e a versão da meta na mesma transação; reconsultar a meta após sucesso.
GET dashboard apenas agrega contagens atuais, sem gravação. Frameworks e
avaliações não são alterados. [Contrato](goal-action-completion.md).

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [ActionPlanResponse](governance-contracts.md#actionplanresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "id": "00000010-0010-4010-8010-000000000010",
    "workspaceId": "00000001-0001-4001-8001-000000000001",
    "controlAssessmentId": "00000007-0007-4007-8007-000000000007",
    "goalId": null,
    "title": "Formalizar aprovação",
    "description": null,
    "ownerMemberId": "00000011-0011-4011-8011-000000000011",
    "status": "DONE",
    "dueDate": "2026-12-31",
    "completedAt": "2026-10-03T09:00:00.000-03:00",
    "createdBy": "00000012-0012-4012-8012-000000000012",
    "version": 3,
    "createdAt": "2026-10-03T09:00:00.000-03:00",
    "updatedAt": "2026-10-03T09:00:00.000-03:00"
  },
  "message": "Ação concluída com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 409 | GOVERNANCE_VERSION_CONFLICT | Agregado alterado por outra escrita. | Consultar versão, conciliar e reenviar. |
| 409 | GOVERNANCE_ACTION_TERMINAL | Ação DONE/CANCELLED. | Consultar resultado; estado terminal. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado impede escrita/cálculo. | Usar projeto ativo ou consultar histórico. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:governance-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O recurso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/actions/00000010-0010-4010-8010-000000000010/complete",
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/metrics

### Objetivo e acesso

**OpenAPI operationId:** `listGovernanceMetrics`. Métricas disponíveis consultadas com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |

Não aceita query; enviar GET sem body.

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/metrics
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [MetricsResponse](governance-contracts.md#metricsresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "goalTypes": [
      "AUTOMATION_COVERAGE",
      "CRITICAL_DEFECTS",
      "GOVERNANCE_SCORE"
    ],
    "indicatorType": "INTERNAL"
  },
  "message": "Métricas disponíveis consultadas com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/metrics",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## GET /api/v1/workspaces/{workspaceId}/governance/dashboard

### Objetivo e acesso

**OpenAPI operationId:** `getGovernanceDashboard`. Dashboard consultado com sucesso. Bearer válido, Workspace
ACTIVE/membership atual e **governance.read**. IDs vêm das listas/criações deste
módulo; projectId de Projetos, ownerMemberId de membros, referenceId da biblioteca.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer | sim | Access token; não usar refresh. |
| rota | workspaceId | UUID v4 | sim | No Workspace/Framework/Assessment da rota. |

Não aceita query; enviar GET sem body.

```http
GET /api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/dashboard
Authorization: Bearer <accessToken>
```

Metas vinculadas usam conclusão por ações. Criar/concluir ações atualiza a
situação e a versão da meta na mesma transação; reconsultar a meta após sucesso.
GET dashboard apenas agrega contagens atuais, sem gravação. Frameworks e
avaliações não são alterados. [Contrato](goal-action-completion.md).

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control:no-store e
X-Request-Id. Campos de data: [DashboardResponse](governance-contracts.md#dashboardresponse);
null explícito e dados de ator/data vêm do servidor.

```json
{
  "data": {
    "indicatorType": "INTERNAL",
    "frameworks": 1,
    "assessments": {
      "draft": 0,
      "inProgress": 0,
      "closed": 1
    },
    "latestAssessments": [
      {
        "frameworkId": "00000003-0003-4003-8003-000000000003",
        "assessmentId": "00000006-0006-4006-8006-000000000006",
        "frameworkName": "Política interna",
        "closedAt": "2026-10-03T09:00:00.000-03:00",
        "index": 100
      }
    ],
    "goals": {
      "active": 1,
      "achieved": 0,
      "missed": 0,
      "cancelled": 0
    },
    "actions": {
      "open": 1,
      "inProgress": 0,
      "done": 0,
      "cancelled": 0
    },
    "attention": {
      "notMetControls": 0,
      "partiallyMetControls": 0,
      "expiredEvidence": 0
    }
  },
  "message": "Dashboard consultado com sucesso.",
  "meta": {
    "requestId": "00000013-0013-4013-8013-000000000013",
    "timestamp": "2026-10-03T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Tipo, limite, combinação, UUID, enum, data ou query inválidos. | Corrigir formulário; mapear errors quando presentes. |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão inválida/ausente/expirada. | Seguir autenticação; não renovar em loop. |
| 403 | AUTH_FORBIDDEN | Sem grant ou acesso à fonte/projeto/arquivo requerido. | Recarregar capacidades e restringir ação. |
| 404 | RESOURCE_NOT_FOUND | Recurso ausente ou fora do escopo visível. | Reconsultar contexto sem inferir outro tenant. |
| 413 | PAYLOAD_TOO_LARGE | JSON excede 32 KiB. | Reduzir payload. |
| 500 | INTERNAL_ERROR | Falha inesperada. | Preservar requestId e confirmar estado. |
| 503 | SERVICE_UNAVAILABLE | Indisponibilidade ou conflito transacional. | GET com backoff; confirmar estado antes de escrita. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/00000001-0001-4001-8001-000000000001/governance/dashboard",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "00000013-0013-4013-8013-000000000013",
  "timestamp": "2026-10-03T09:00:00.000-03:00"
}
```

Mapear errors[].field/code/message quando presentes; preservar requestId. 401 segue autenticação, 403 atualiza grants, 404 limpa contexto, 409 reconsulta agregado. GET pode repetir com backoff; rede/timeout em escrita exige consultar estado antes de repetir. Sem chave idempotente ou repetição cega de mutação.

### Fluxo de integração

1. Selecionar Workspace, consultar acesso e IDs do escopo; iniciar loading.
2. Enviar chamada; serializar escritas no agregado usando versão atual.
3. Aplicar resposta/versão, atualizar listas/dashboard e invalidar cache do escopo.
4. Tratar campos/estado/acesso/rede conforme HTTP/code; encerrar loading.

Os [fluxos e regras](governance-contracts.md) detalham snapshots, estados e autorização; limpar cache na troca de Workspace/Projeto/logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** criação na Fase 06; primeira versão deste endpoint.
- **Impacto:** integrar novos DTOs e grants; catálogo de permissões passa a 32.
- **Migração:** aplicar 202610030006_governance; rotas anteriores mantêm contratos.
- **Limitações:** índice interno, URLs manuais e somente métricas disponíveis em GET metrics; sem certificação ou agendamento de cálculo.
- **Verificação:** unitários/HTTP, fluxos MySQL, upgrade e isolamento; resultados nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega). Banco configurado não migrado.

## Acompanhamento de frameworks — leitura adicional

[GET framework progress](framework-progress.md#get-apiv1workspacesworkspaceidgovernanceframeworksframeworkidprogress) é o 33º endpoint de governança; contrato, exemplos e fluxo de integração no guia de acompanhamento.

Atualização de 06/10/2026: criação/alteração/listagem de controles retornam
creationOrder numérico técnico, sem aceitá-lo como entrada. A ordem padrão do
GET controls passa de code para creationOrder crescente; filtros/paginação e
ordenação explícita por code/title permanecem disponíveis. Dados legados recebem
sequência determinística; novos seguem a inserção. Snapshots históricos não mudam.
