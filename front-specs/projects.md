# Projetos, participantes, marcos e ambientes

Disponibilidade: Fase 02 implementada em 02/10/2026, API v1. 19 novos endpoints.
Leia primeiro [contratos de Projetos](project-contracts.md); esta documentação
segue [ENDPOINT_TEMPLATE.md](ENDPOINT_TEMPLATE.md). OpenAPI ao vivo: /docs-json;
[snapshot da entrega](openapi.json).

## GET /api/v1/workspaces/{workspaceId}/projects

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Listar projetos visíveis; sort: name,key,createdAt; permission: project.read.

OpenAPI operationId: `listProjects`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Somente projetos visíveis entram em data e totalItems. status padrão ACTIVE; ARCHIVED/ALL incluem arquivados. sort: name,key,createdAt. q pesquisa nome/key. Lista vazia é 200.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                            |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.                 |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.                     |
| query  | page          | number       | não         | Padrão: 1. Mínimo 1. Máximo 100000.               |
| query  | size          | number       | não         | Padrão: 20. Mínimo 1. Máximo 100.                 |
| query  | sort          | string       | não         |                                                   |
| query  | q             | string       | não         | Máximo 100 caracteres.                            |
| query  | status        | string       | não         | Valores: ACTIVE, ARCHIVED, ALL. Padrão: "ACTIVE". |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [ProjectResponse](project-contracts.md#projectresponse); relações são DTOs públicos.

```json
{
  "data": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "key": "PORTAL",
      "name": "Portal Cliente",
      "description": null,
      "status": "ACTIVE",
      "createdAt": "2026-10-02T12:00:00.000-03:00",
      "updatedAt": "2026-10-02T12:00:00.000-03:00",
      "archivedAt": null,
      "projectRole": "MANAGER",
      "permissions": [
        "project.read",
        "project.update",
        "project.archive",
        "project.manage_members",
        "milestone.manage",
        "environment.manage"
      ]
    }
  ],
  "message": "Projetos consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00",
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

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## POST /api/v1/workspaces/{workspaceId}/projects

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Criar projeto e vínculo MANAGER; permission: project.create.

OpenAPI operationId: `createProject`. Bearer obrigatório; permission `project.create`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Key uppercase, 2–12 caracteres, única no Workspace e imutável. Criador recebe vínculo MANAGER, mas capabilities continuam limitadas às permissions do Workspace. Em timeout, buscar pela key antes de repetir POST.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                                                 |
| ------ | ------------- | ------------ | ----------- | ---------------------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.                                      |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.                                          |
| body   | key           | string       | sim         | Mínimo 2 caracteres. Máximo 12 caracteres. Formato: ^[A-Z][A-Z0-9_]*$. |
| body   | name          | string       | sim         | Mínimo 1 caracteres. Máximo 100 caracteres.                            |
| body   | description   | string       | não         | Aceita null. Máximo 500 caracteres.                                    |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "key": "PORTAL",
  "name": "Portal Cliente",
  "description": "Aplicação do cliente"
}
```

### Respostas de sucesso

HTTP **201**; X-Request-Id e Cache-Control: no-store. Location aponta para o recurso criado.
Campos de data conforme [ProjectResponse](project-contracts.md#projectresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "PORTAL",
    "name": "Portal Cliente",
    "description": null,
    "status": "ACTIVE",
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "archivedAt": null,
    "projectRole": "MANAGER",
    "permissions": [
      "project.read",
      "project.update",
      "project.archive",
      "project.manage_members",
      "milestone.manage",
      "environment.manage"
    ]
  },
  "message": "Projeto criado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | RESOURCE_CONFLICT                                                       | Key/nome já reservado no escopo                     | Corrigir valor, confirmar registro antes de repetir.            |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Consultar projeto e capabilities; permission: project.read.

OpenAPI operationId: `getProject`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

permissions é a interseção efetiva para a UI; projectRole pode ser null para administrador sem vínculo local. Recarregar após alterações de acesso. Projeto invisível retorna 404.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [ProjectResponse](project-contracts.md#projectresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "PORTAL",
    "name": "Portal Cliente",
    "description": null,
    "status": "ACTIVE",
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "archivedAt": null,
    "projectRole": "MANAGER",
    "permissions": [
      "project.read",
      "project.update",
      "project.archive",
      "project.manage_members",
      "milestone.manage",
      "environment.manage"
    ]
  },
  "message": "Projeto consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Alterar nome/descrição; key imutável; permission: project.update.

OpenAPI operationId: `updateProject`. Bearer obrigatório; permission `project.update`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Somente name/description; key/status/IDs não são aceitos. description null limpa o campo; name null inválido. Projeto arquivado dá 409.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                      |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.           |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.               |
| body   | name          | string       | não         | Mínimo 1 caracteres. Máximo 100 caracteres. |
| body   | description   | string       | não         | Aceita null. Máximo 500 caracteres.         |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Portal revisado",
  "description": null
}
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [ProjectResponse](project-contracts.md#projectresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "PORTAL",
    "name": "Portal revisado",
    "description": null,
    "status": "ACTIVE",
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "archivedAt": null,
    "projectRole": "MANAGER",
    "permissions": [
      "project.read",
      "project.update",
      "project.archive",
      "project.manage_members",
      "milestone.manage",
      "environment.manage"
    ]
  },
  "message": "Projeto atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/archive

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Arquivar sem apagar histórico; permission: project.archive.

OpenAPI operationId: `archiveProject`. Bearer obrigatório; permission `project.archive`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Preserva participantes, marcos e ambientes. Leituras autorizadas continuam. Mutações ficam bloqueadas. Repetição retorna 200 com archivedAt original, sem duplicar evento de arquivamento. Não há restore nesta fase.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/archive
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [ProjectResponse](project-contracts.md#projectresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "PORTAL",
    "name": "Portal Cliente",
    "description": null,
    "status": "ARCHIVED",
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "archivedAt": "2026-10-02T12:00:00.000-03:00",
    "projectRole": "MANAGER",
    "permissions": [
      "project.read",
      "project.update",
      "project.archive",
      "project.manage_members",
      "milestone.manage",
      "environment.manage"
    ]
  },
  "message": "Projeto arquivado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/archive",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/members

### Objetivo e acesso

Listar participantes; sort: createdAt,projectRole; permission: project.read.

OpenAPI operationId: `listProjectMembers`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

IDs de participantes são workspaceMemberId (não User.id). Listagem inclui User público e estado do vínculo no Workspace. sort: createdAt,projectRole. Sem q/status nesta rota; campos extras são rejeitados.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                              |
| ------ | ------------- | ------------ | ----------- | ----------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.   |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.       |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.       |
| query  | page          | number       | não         | Padrão: 1. Mínimo 1. Máximo 100000. |
| query  | size          | number       | não         | Padrão: 20. Mínimo 1. Máximo 100.   |
| query  | sort          | string       | não         |                                     |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/members
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [ProjectMemberListResponse](project-contracts.md#projectmemberlistresponse); relações são DTOs públicos.

```json
{
  "data": [
    {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "workspaceMemberId": "33333333-3333-4333-8333-333333333333",
      "projectRole": "VIEWER",
      "createdAt": "2026-10-02T12:00:00.000-03:00",
      "updatedAt": "2026-10-02T12:00:00.000-03:00",
      "workspaceMemberStatus": "ACTIVE",
      "user": {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "email": "qa@example.com",
        "displayName": "Pessoa de QA",
        "status": "ACTIVE",
        "emailVerifiedAt": "2026-10-02T12:00:00.000-03:00"
      }
    }
  ],
  "message": "Participantes consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00",
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

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/members",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{workspaceMemberId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Atribuir/alterar role local de participante; permission: project.manage_members.

OpenAPI operationId: `assignProjectMember`. Bearer obrigatório; permission `project.manage_members`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

PUT por workspaceMemberId cria/altera vínculo; retorna 200 em ambos. Membro precisa estar ACTIVE e User ACTIVE. Ator deve possuir todas as capabilities da role local atribuída. VIEWER/EDITOR/MANAGER não substituem permissões do Workspace.

### Requisição

| Local  | Campo             | Tipo/formato | Obrigatório | Regras                            |
| ------ | ----------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization     | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId       | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId         | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | workspaceMemberId | uuid         | sim         | UUID v4 do escopo solicitado.     |
| body   | projectRole       | string       | sim         | Valores: VIEWER, EDITOR, MANAGER. |

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/members/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "projectRole": "VIEWER"
}
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [ProjectMemberResponse](project-contracts.md#projectmemberresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "workspaceMemberId": "33333333-3333-4333-8333-333333333333",
    "projectRole": "VIEWER",
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00"
  },
  "message": "Participante atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 409     | PROJECT_MEMBER_INACTIVE                                                 | User suspenso                                       | Escolher participante ativo; não insistir.                      |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/members/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{workspaceMemberId}

### Objetivo e acesso

Revogar acesso local do participante; permission: project.manage_members.

OpenAPI operationId: `removeProjectMember`. Bearer obrigatório; permission `project.manage_members`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Remove somente acesso local. Não remove User ou WorkspaceMember. Repetição é 204 enquanto o WorkspaceMember existe. Suspensão/removal do Workspace revoga acesso; removal também limpa os vínculos de projeto. Reentrada não recupera grants.

### Requisição

| Local  | Campo             | Tipo/formato | Obrigatório | Regras                            |
| ------ | ----------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization     | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId       | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId         | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | workspaceMemberId | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/members/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**; X-Request-Id e Cache-Control: no-store.
Sem corpo; não executar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/members/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones

### Objetivo e acesso

Listar marcos; sort: name,createdAt,dueDate; permission: project.read.

OpenAPI operationId: `listMilestones`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Somente não excluídos. q pesquisa nome; status PLANNED/IN_PROGRESS/COMPLETED/CANCELLED/ALL; ausente inclui todos. sort: name,createdAt,dueDate. Datas são calendário, sem fuso.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                                    |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.                         |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.                             |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.                             |
| query  | page          | number       | não         | Padrão: 1. Mínimo 1. Máximo 100000.                       |
| query  | size          | number       | não         | Padrão: 20. Mínimo 1. Máximo 100.                         |
| query  | sort          | string       | não         |                                                           |
| query  | q             | string       | não         | Máximo 100 caracteres.                                    |
| query  | status        | string       | não         | Valores: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ALL. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [MilestoneResponse](project-contracts.md#milestoneresponse); relações são DTOs públicos.

```json
{
  "data": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "name": "Release 1",
      "description": null,
      "status": "PLANNED",
      "startDate": "2026-10-02",
      "dueDate": "2026-10-10",
      "completedAt": null,
      "createdAt": "2026-10-02T12:00:00.000-03:00",
      "updatedAt": "2026-10-02T12:00:00.000-03:00",
      "deletedAt": null
    }
  ],
  "message": "Marcos consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00",
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

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones

### Objetivo e acesso

Criar marco PLANNED; permission: milestone.manage.

OpenAPI operationId: `createMilestone`. Bearer obrigatório; permission `milestone.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Nasce PLANNED. startDate/dueDate ausentes ou null são permitidos; formato YYYY-MM-DD, ano 1000–9999, início <= prazo. Não enviar status/IDs/completedAt.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                      |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.           |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.               |
| body   | name          | string       | sim         | Mínimo 1 caracteres. Máximo 100 caracteres. |
| body   | description   | string       | não         | Aceita null. Máximo 500 caracteres.         |
| body   | startDate     | date         | não         | Aceita null.                                |
| body   | dueDate       | date         | não         | Aceita null.                                |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Release 1",
  "startDate": "2026-10-02",
  "dueDate": "2026-10-10"
}
```

### Respostas de sucesso

HTTP **201**; X-Request-Id e Cache-Control: no-store. Location aponta para o recurso criado.
Campos de data conforme [MilestoneResponse](project-contracts.md#milestoneresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "Release 1",
    "description": null,
    "status": "PLANNED",
    "startDate": "2026-10-02",
    "dueDate": "2026-10-10",
    "completedAt": null,
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null
  },
  "message": "Marco criado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}

### Objetivo e acesso

Consultar marco do projeto; permission: project.read.

OpenAPI operationId: `getMilestone`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Busca por Workspace + Project + milestoneId; ID de marco de outro projeto dá 404. deletedAt é null nas consultas disponíveis.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | milestoneId   | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [MilestoneResponse](project-contracts.md#milestoneresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "Release 1",
    "description": null,
    "status": "PLANNED",
    "startDate": "2026-10-02",
    "dueDate": "2026-10-10",
    "completedAt": null,
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null
  },
  "message": "Marco consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}

### Objetivo e acesso

Alterar marco não concluído; permission: milestone.manage.

OpenAPI operationId: `updateMilestone`. Bearer obrigatório; permission `milestone.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Campos ausentes preservam valores. description/startDate/dueDate aceitam null. status permite PLANNED/IN_PROGRESS/CANCELLED; para concluir usar /complete. COMPLETED não pode ser reescrito. Cancelado pode voltar a PLANNED/IN_PROGRESS por PATCH.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                      |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.           |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | milestoneId   | uuid         | sim         | UUID v4 do escopo solicitado.               |
| body   | name          | string       | não         | Mínimo 1 caracteres. Máximo 100 caracteres. |
| body   | description   | string       | não         | Aceita null. Máximo 500 caracteres.         |
| body   | startDate     | date         | não         | Aceita null.                                |
| body   | dueDate       | date         | não         | Aceita null.                                |
| body   | status        | string       | não         | Valores: PLANNED, IN_PROGRESS, CANCELLED.   |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "status": "IN_PROGRESS",
  "description": "Em execução"
}
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [MilestoneResponse](project-contracts.md#milestoneresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "Release 1",
    "description": "Em execução",
    "status": "IN_PROGRESS",
    "startDate": "2026-10-02",
    "dueDate": "2026-10-10",
    "completedAt": null,
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null
  },
  "message": "Marco atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 409     | MILESTONE_COMPLETED                                                     | Marco concluído                                     | Preservar histórico; recarregar marco.                          |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}

### Objetivo e acesso

Excluir marco logicamente; permission: milestone.manage.

OpenAPI operationId: `deleteMilestone`. Bearer obrigatório; permission `milestone.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Exclusão lógica, com preservação de datas/estado/histórico. Repetir é 204; consultas/listas passam a omitir o marco. Projeto arquivado não permite a exclusão.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | milestoneId   | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**; X-Request-Id e Cache-Control: no-store.
Sem corpo; não executar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}/complete

### Objetivo e acesso

Concluir marco de forma idempotente; permission: milestone.manage.

OpenAPI operationId: `completeMilestone`. Bearer obrigatório; permission `milestone.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Conclui uma única vez com completedAt UTC. Retry/conclusões simultâneas retornam o mesmo timestamp; evento não duplica. CANCELLED dá 409; projeto arquivado dá 409.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | milestoneId   | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444/complete
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [MilestoneResponse](project-contracts.md#milestoneresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "Release 1",
    "description": null,
    "status": "COMPLETED",
    "startDate": "2026-10-02",
    "dueDate": "2026-10-10",
    "completedAt": "2026-10-02T12:00:00.000-03:00",
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null
  },
  "message": "Marco concluído com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 409     | MILESTONE_CANCELLED                                                     | Marco cancelado                                     | Atualizar estado permitido antes da conclusão.                  |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/milestones/44444444-4444-4444-8444-444444444444/complete",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/environments

Atualização 04/10/2026: EnvironmentResponse inclui category (PRODUCTION/HOMOLOGATION/OTHER). POST/PATCH aceitam category opcional; padrão OTHER na criação, ausência preserva no PATCH. DELETE conserva histórico. Consulte [área de Ambientes e regras do front](defect-analytics.md#área-específica-de-ambientes--especificação-para-o-front).

### Objetivo e acesso

Listar ambientes; sort: name,createdAt; permission: project.read.

OpenAPI operationId: `listEnvironments`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Somente não excluídos. q pesquisa nome; active=true/false, ausente inclui ambos. sort: name,createdAt. Não usar active=1/0.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                              |
| ------ | ------------- | ------------ | ----------- | ----------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.   |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.       |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.       |
| query  | page          | number       | não         | Padrão: 1. Mínimo 1. Máximo 100000. |
| query  | size          | number       | não         | Padrão: 20. Mínimo 1. Máximo 100.   |
| query  | sort          | string       | não         |                                     |
| query  | q             | string       | não         | Máximo 100 caracteres.              |
| query  | active        | boolean      | não         |                                     |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [EnvironmentResponse](project-contracts.md#environmentresponse); relações são DTOs públicos.

```json
{
  "data": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "name": "HML",
      "description": "Homologação",
      "active": true,
      "createdAt": "2026-10-02T12:00:00.000-03:00",
      "updatedAt": "2026-10-02T12:00:00.000-03:00",
      "deletedAt": null,
      "category": "OTHER"
    }
  ],
  "message": "Ambientes consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00",
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

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/environments

Atualização 04/10/2026: EnvironmentResponse inclui category (PRODUCTION/HOMOLOGATION/OTHER). POST/PATCH aceitam category opcional; padrão OTHER na criação, ausência preserva no PATCH. DELETE conserva histórico. Consulte [área de Ambientes e regras do front](defect-analytics.md#área-específica-de-ambientes--especificação-para-o-front).

### Objetivo e acesso

Criar ambiente; permission: environment.manage.

OpenAPI operationId: `createEnvironment`. Bearer obrigatório; permission `environment.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Nome único normalizado (trim/NFKC/lowercase) por projeto; duplicado dá RESOURCE_CONFLICT. active padrão true. Nomes de ambientes excluídos continuam reservados.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                      |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.           |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.               |
| body   | name          | string       | sim         | Mínimo 1 caracteres. Máximo 100 caracteres. |
| body   | description   | string       | não         | Aceita null. Máximo 500 caracteres.         |
| body   | active        | boolean      | não         | Padrão: true.                               |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "HML",
  "description": "Homologação",
  "active": true
}
```

### Respostas de sucesso

HTTP **201**; X-Request-Id e Cache-Control: no-store. Location aponta para o recurso criado.
Campos de data conforme [EnvironmentResponse](project-contracts.md#environmentresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "HML",
    "description": "Homologação",
    "active": true,
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null,
    "category": "OTHER"
  },
  "message": "Ambiente criado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 409     | RESOURCE_CONFLICT                                                       | Key/nome já reservado no escopo                     | Corrigir valor, confirmar registro antes de repetir.            |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/environments/{environmentId}

Atualização 04/10/2026: EnvironmentResponse inclui category (PRODUCTION/HOMOLOGATION/OTHER). POST/PATCH aceitam category opcional; padrão OTHER na criação, ausência preserva no PATCH. DELETE conserva histórico. Consulte [área de Ambientes e regras do front](defect-analytics.md#área-específica-de-ambientes--especificação-para-o-front).

### Objetivo e acesso

Consultar ambiente do projeto; permission: project.read.

OpenAPI operationId: `getEnvironment`. Bearer obrigatório; permission `project.read`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Consulta escopada por Workspace/Project/environmentId. Não expõe normalizedName ou detalhes internos. Ambiente inativo continua consultável.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | environmentId | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [EnvironmentResponse](project-contracts.md#environmentresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "HML",
    "description": "Homologação",
    "active": true,
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null,
    "category": "OTHER"
  },
  "message": "Ambiente consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments/55555555-5555-4555-8555-555555555555",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Leituras podem ser repetidas com retry limitado em falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/environments/{environmentId}

Atualização 04/10/2026: EnvironmentResponse inclui category (PRODUCTION/HOMOLOGATION/OTHER). POST/PATCH aceitam category opcional; padrão OTHER na criação, ausência preserva no PATCH. DELETE conserva histórico. Consulte [área de Ambientes e regras do front](defect-analytics.md#área-específica-de-ambientes--especificação-para-o-front).

### Objetivo e acesso

Alterar/desativar ambiente; permission: environment.manage.

OpenAPI operationId: `updateEnvironment`. Bearer obrigatório; permission `environment.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

name/description/active opcionais. active exige boolean JSON; null é recusado. active=false desativa sem excluir, preservando consulta.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                                      |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh.           |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.               |
| rota   | environmentId | uuid         | sim         | UUID v4 do escopo solicitado.               |
| body   | name          | string       | não         | Mínimo 1 caracteres. Máximo 100 caracteres. |
| body   | description   | string       | não         | Aceita null. Máximo 500 caracteres.         |
| body   | active        | boolean      | não         |                                             |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "active": false
}
```

### Respostas de sucesso

HTTP **200**; X-Request-Id e Cache-Control: no-store.
Campos de data conforme [EnvironmentResponse](project-contracts.md#environmentresponse); relações são DTOs públicos.

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "name": "HML",
    "description": "Homologação",
    "active": false,
    "createdAt": "2026-10-02T12:00:00.000-03:00",
    "updatedAt": "2026-10-02T12:00:00.000-03:00",
    "deletedAt": null,
    "category": "OTHER"
  },
  "message": "Ambiente atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T12:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 409     | RESOURCE_CONFLICT                                                       | Key/nome já reservado no escopo                     | Corrigir valor, confirmar registro antes de repetir.            |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments/55555555-5555-4555-8555-555555555555",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/environments/{environmentId}

Atualização 04/10/2026: EnvironmentResponse inclui category (PRODUCTION/HOMOLOGATION/OTHER). POST/PATCH aceitam category opcional; padrão OTHER na criação, ausência preserva no PATCH. DELETE conserva histórico. Consulte [área de Ambientes e regras do front](defect-analytics.md#área-específica-de-ambientes--especificação-para-o-front).

### Objetivo e acesso

Excluir ambiente logicamente; permission: environment.manage.

OpenAPI operationId: `deleteEnvironment`. Bearer obrigatório; permission `environment.manage`
e escopo local conforme [matriz de acesso](project-contracts.md#acesso).
workspaceId vem de GET /workspaces; projectId de listagem/criação de projeto;
workspaceMemberId da listagem de membros do Workspace; demais IDs dos filhos.

Exclusão lógica e desativação. Retry retorna 204; GET passa a 404. Nome não pode ser reutilizado. Projeto arquivado impede a operação.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Regras                            |
| ------ | ------------- | ------------ | ----------- | --------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token; não enviar refresh. |
| rota   | workspaceId   | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | projectId     | uuid         | sim         | UUID v4 do escopo solicitado.     |
| rota   | environmentId | uuid         | sim         | UUID v4 do escopo solicitado.     |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**; X-Request-Id e Cache-Control: no-store.
Sem corpo; não executar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | UUID/query/JSON/campo/data inválido                 | Exibir errors por field; preservar formulário.                  |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação falha                                  | Seguir authentication.md, sem renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Projeto visível, permission/capability insuficiente | Recarregar capacidades e desabilitar ação.                      |
| 404     | RESOURCE_NOT_FOUND                                                      | Tenant/projeto/recurso não visível                  | Limpar cache do escopo; não inferir outro tenant.               |
| 409     | PROJECT_ARCHIVED                                                        | Projeto arquivado                                   | Manter apenas leituras e recarregar projeto.                    |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha interna/dependência/concor­rência             | Preservar requestId; confirmar estado antes de repetir mutação. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/environments/55555555-5555-4555-8555-555555555555",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T12:00:00.000-03:00"
}
```

### Fluxo de integração

1. Selecionar Workspace/projeto, resolver IDs e iniciar loading.
2. Enviar bearer e apenas uma submissão por formulário.
3. Atualizar caches incluindo workspaceId/projectId e recarregar permissions quando aplicável.
4. Tratar errors/sessão/permissões, preservar requestId e encerrar loading.

Em timeout, confirmar o estado por GET/listagem antes de repetir. PUT de vínculo
é idempotente quanto à associação; archive/complete preservam o primeiro timestamp.
DELETE de filhos/concessão é idempotente; projeto arquivado bloqueia mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera identidade. A Fase 02 não implementou casos ou execução. Casos/vínculos estão agora
disponíveis na Fase 03; Planos/Execuções disponíveis na Fase 04. Catálogos
de Workspace continuam disponíveis. Permissões de sistema foram ampliadas
explicitamente; customizadas não recebem permissões novas automaticamente.
Verificação: suíte MySQL e HTTP da fase, com isolamento, concorrência,
revogação e upgrade de grants; resultados no [plano](../codex/CODEX_IMPLEMENTATION_PLAN.md).

Governança usa grants do Workspace sem ampliar roles locais de Projeto; ver
[metas, acesso e compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

## Atualização de acesso — 06/10/2026

Capabilities de projeto incluem testvault.read/reveal para VIEWER e
read/reveal/manage para EDITOR/MANAGER, sempre intersectadas com os grants atuais
do Workspace. Não são novas concessões automáticas a Member. Consulte [cofre](test-vault.md).
Na atribuição de participantes, ampliação efetiva de acesso ao cofre exige a
capability correspondente no ator. Atribuir VIEWER a quem não possui grants do
cofre mantém o fluxo anterior. Consulte permissões retornadas por projeto em cada
contexto; não inferir autorização somente pelo nome do papel.
