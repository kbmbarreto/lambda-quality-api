# Roles, permissions e grupos

Disponibilidade: implementado na Fase 01. API v1; atualização: 02/10/2026.
Swagger: [localhost:3000/docs](http://localhost:3000/docs); contrato JSON em
[openapi.json](openapi.json). Ler primeiro o [fluxo e contratos comuns](workspace-contracts.md).

Os IDs dos exemplos são fictícios; substituir pelos IDs retornados pela API.
Projetos e Casos de Teste estão disponíveis; ver [índice](README.md).
Planos e Execuções disponíveis na Fase 04; [Defeitos](defect-contracts.md) na Fase 05.

## GET /api/v1/permissions

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Consultar catálogo global de permissions disponíveis.

**OpenAPI operationId:** `getPermissionCatalog`. Acesso: Bearer válido; sem permission de tenant para o catálogo global/criação. A lista inclui somente Workspaces acessíveis.

Catálogo global desta fase; resposta data.permissions. Não são as permissions concedidas ao usuário. Para capacidades do Workspace, usar GET do Workspace.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                         |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------------ |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer. |

```http
GET /api/v1/permissions
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [PermissionCatalogResponse](workspace-contracts.md#permissioncatalogresponse).

```json
{
  "data": {
    "permissions": [
      {
        "code": "workspace.read",
        "description": "Consultar Workspace, membros, roles e grupos."
      },
      {
        "code": "workspace.update",
        "description": "Alterar dados do Workspace."
      },
      {
        "code": "workspace.manage_members",
        "description": "Administrar membros e convites."
      },
      {
        "code": "workspace.manage_roles",
        "description": "Administrar roles e concessões diretas."
      },
      {
        "code": "workspace.manage_groups",
        "description": "Administrar grupos e concessões coletivas."
      },
      {
        "code": "field.read",
        "description": "Consultar campos personalizados."
      },
      {
        "code": "field.manage",
        "description": "Administrar campos personalizados."
      },
      {
        "code": "tag.read",
        "description": "Consultar tags."
      },
      {
        "code": "tag.manage",
        "description": "Administrar tags."
      },
      {
        "code": "attachment.read",
        "description": "Consultar e baixar anexos."
      },
      {
        "code": "attachment.upload",
        "description": "Enviar anexos."
      },
      {
        "code": "attachment.delete",
        "description": "Excluir anexos."
      },
      {
        "code": "project.read",
        "description": "Consultar projetos visíveis."
      },
      {
        "code": "project.create",
        "description": "Criar projetos."
      },
      {
        "code": "project.update",
        "description": "Alterar projetos visíveis."
      },
      {
        "code": "project.archive",
        "description": "Arquivar projetos visíveis."
      },
      {
        "code": "project.manage_members",
        "description": "Administrar participantes do projeto."
      },
      {
        "code": "project.manage_all",
        "description": "Acessar todos os projetos do Workspace sem vínculo local."
      },
      {
        "code": "milestone.manage",
        "description": "Administrar marcos de projetos visíveis."
      },
      {
        "code": "environment.manage",
        "description": "Administrar ambientes de projetos visíveis."
      },
      {
        "code": "testcase.read",
        "description": "Consultar suítes, casos e passos."
      },
      {
        "code": "testcase.create",
        "description": "Criar suítes e casos de teste."
      },
      {
        "code": "testcase.update",
        "description": "Alterar suítes, casos, passos e vínculos."
      },
      {
        "code": "testcase.archive",
        "description": "Arquivar suítes e arquivar/restaurar casos."
      },
      {
        "code": "testrun.read",
        "description": "Consultar planos, execuções e resultados."
      },
      {
        "code": "testrun.execute",
        "description": "Iniciar, executar e concluir execuções."
      },
      {
        "code": "testrun.manage",
        "description": "Administrar planos, criar e abortar execuções."
      },
      {
        "code": "defect.read",
        "description": "Consultar defeitos e seus vínculos."
      },
      {
        "code": "defect.manage",
        "description": "Criar e alterar defeitos, estados e vínculos."
      },
      {
        "code": "governance.read",
        "description": "Consultar governança."
      },
      {
        "code": "governance.assess",
        "description": "Avaliar controles e evidências."
      },
      {
        "code": "governance.manage",
        "description": "Administrar frameworks, metas e ações."
      }
    ]
  },
  "message": "Permissions consultadas com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                             | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido | Associar errors ao formulário quando presentes.                 |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida             | Seguir o guia de autenticação; não renovar em loop.             |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência | Preservar requestId; confirmar estado antes de repetir mutação. |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os campos informados e tente novamente.",
  "instance": "/api/v1/permissions",
  "code": "VALIDATION_ERROR",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Leituras podem ser refeitas com política limitada após falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## GET /api/v1/workspaces/{workspaceId}/roles

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Listar roles; sort: name, createdAt.

**OpenAPI operationId:** `listWorkspaceRoles`. Acesso: `workspace.read`.

Consultar dados do mesmo Workspace; buscas por ID validam tenant e membership atuais.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                            |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                              |
| query  | sort          | string       | não         |                                                           |
| query  | q             | string       | não         | máx. 100 caracteres                                       |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`name,asc`; campos permitidos: name, createdAt, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [RoleResponse](workspace-contracts.md#roleresponse).

```json
{
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "name": "Analistas",
      "description": null,
      "systemRole": false,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "permissionCodes": ["attachment.upload", "workspace.read"]
    }
  ],
  "message": "Roles consultadas com sucesso.",
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

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Leituras podem ser refeitas com política limitada após falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## POST /api/v1/workspaces/{workspaceId}/roles

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Criar role customizada; permission: workspace.manage_roles.

**OpenAPI operationId:** `createWorkspaceRole`. Acesso: `workspace.manage_roles`; concessões não podem exceder permissions atuais do ator.

Nomes Owner/Administrator/Member são reservados, inclusive após normalização. permissionCodes vem do catálogo global; códigos de módulos futuros são recusados. Pode criar role sem permissions. Não conceder direitos que o ator não possui.

### Requisição

| Local  | Campo           | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | --------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization   | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId     | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name            | string       | sim         | mín. 1 caracteres; máx. 100 caracteres                    |
| body   | description     | string       | não         | Aceita null.; máx. 500 caracteres                         |
| body   | permissionCodes | string[]     | sim         | Ausente segue as regras da operação.                      |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Analistas",
  "permissionCodes": ["workspace.read", "attachment.upload"]
}
```

### Respostas de sucesso

HTTP **201**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [RoleResponse](workspace-contracts.md#roleresponse).

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "Analistas",
    "description": null,
    "systemRole": false,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "permissionCodes": ["attachment.upload", "workspace.read"]
  },
  "message": "Role criada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                           | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido               | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                           | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível                        | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente            | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                                  | Confirmar estado e apresentar mensagem da API.                       |
| 409     | WORKSPACE_SYSTEM_ROLE_PROTECTED                                         | Nome reservado ou alteração/exclusão de role de sistema | Usar role customizada com nome permitido.                            |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência               | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## GET /api/v1/workspaces/{workspaceId}/roles/{roleId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Consultar role e permissions.

**OpenAPI operationId:** `getWorkspaceRole`. Acesso: `workspace.read`.

Consultar dados do mesmo Workspace; buscas por ID validam tenant e membership atuais.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId        | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [RoleResponse](workspace-contracts.md#roleresponse).

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "Analistas",
    "description": null,
    "systemRole": false,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "permissionCodes": ["attachment.upload", "workspace.read"]
  },
  "message": "Role consultada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Leituras podem ser refeitas com política limitada após falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## PATCH /api/v1/workspaces/{workspaceId}/roles/{roleId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Alterar role customizada; permission: workspace.manage_roles.

**OpenAPI operationId:** `updateWorkspaceRole`. Acesso: `workspace.manage_roles`; concessões não podem exceder permissions atuais do ator.

Roles de sistema são imutáveis. permissionCodes substitui a lista inteira quando presente; [] revoga todas. Description null limpa o texto. Tipo de concessão sem denies explícitos. Mudanças valem na próxima requisição após commit.

### Requisição

| Local  | Campo           | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | --------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization   | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId     | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId          | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name            | string       | não         | mín. 1 caracteres; máx. 100 caracteres                    |
| body   | description     | string       | não         | Aceita null.; máx. 500 caracteres                         |
| body   | permissionCodes | string[]     | não         | Ausente segue as regras da operação.                      |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "description": "Equipe de análise de testes"
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [RoleResponse](workspace-contracts.md#roleresponse).

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "Analistas",
    "description": null,
    "systemRole": false,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "permissionCodes": ["attachment.upload", "workspace.read"]
  },
  "message": "Role atualizada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                           | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido               | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                           | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível                        | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente            | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                                  | Confirmar estado e apresentar mensagem da API.                       |
| 409     | WORKSPACE_SYSTEM_ROLE_PROTECTED                                         | Nome reservado ou alteração/exclusão de role de sistema | Usar role customizada com nome permitido.                            |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência               | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## DELETE /api/v1/workspaces/{workspaceId}/roles/{roleId}

### Objetivo e acesso

Remover role customizada sem vínculos.

**OpenAPI operationId:** `deleteWorkspaceRole`. Acesso: `workspace.manage_roles`; concessões não podem exceder permissions atuais do ator.

Role customizada só pode ser removida sem associações a membros/grupos; do contrário, 409 WORKSPACE_ROLE_IN_USE. Roles de sistema não podem ser removidas.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId        | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                           | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido               | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                           | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível                        | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente            | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                                  | Confirmar estado e apresentar mensagem da API.                       |
| 409     | WORKSPACE_SYSTEM_ROLE_PROTECTED                                         | Nome reservado ou alteração/exclusão de role de sistema | Usar role customizada com nome permitido.                            |
| 409     | WORKSPACE_ROLE_IN_USE                                                   | Exclusão de role com vínculos                           | Revogar associações primeiro.                                        |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência               | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## PUT /api/v1/workspaces/{workspaceId}/members/{memberId}/roles/{roleId}

### Objetivo e acesso

Atribuir role direta; permission: workspace.manage_roles.

**OpenAPI operationId:** `assignWorkspaceMemberRole`. Acesso: `workspace.manage_roles`; concessões não podem exceder permissions atuais do ator.

Vínculo idempotente, sem duplicação. membro/role devem pertencer ao Workspace. Não altera ownership. Após sucesso, invalidar membro e GET Workspace quando o usuário afetado for o atual.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId        | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## DELETE /api/v1/workspaces/{workspaceId}/members/{memberId}/roles/{roleId}

### Objetivo e acesso

Revogar role direta; permission: workspace.manage_roles.

**OpenAPI operationId:** `revokeWorkspaceMemberRole`. Acesso: `workspace.manage_roles`; concessões não podem exceder permissions atuais do ator.

Revoga somente a concessão direta; uma role herdada por grupo continua concedendo direitos. Vínculo ausente é tratado como já revogado. Auditoria pode registrar novas chamadas idempotentes.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId        | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## GET /api/v1/workspaces/{workspaceId}/groups

### Objetivo e acesso

Listar grupos; sort: name, createdAt.

**OpenAPI operationId:** `listWorkspaceGroups`. Acesso: `workspace.read`.

Consultar dados do mesmo Workspace; buscas por ID validam tenant e membership atuais.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                            |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                              |
| query  | sort          | string       | não         |                                                           |
| query  | q             | string       | não         | máx. 100 caracteres                                       |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`name,asc`; campos permitidos: name, createdAt, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [GroupResponse](workspace-contracts.md#groupresponse).

```json
{
  "data": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "name": "QA",
      "description": null,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "roleIds": ["33333333-3333-4333-8333-333333333333"],
      "memberCount": 1
    }
  ],
  "message": "Grupos consultados com sucesso.",
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

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Leituras podem ser refeitas com política limitada após falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## POST /api/v1/workspaces/{workspaceId}/groups

### Objetivo e acesso

Criar grupo; permission: workspace.manage_groups.

**OpenAPI operationId:** `createWorkspaceGroup`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Nome normalizado único no Workspace. Grupo não cria User/membership; seus participantes devem ser membros existentes.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name          | string       | sim         | mín. 1 caracteres; máx. 100 caracteres                    |
| body   | description   | string       | não         | Aceita null.; máx. 500 caracteres                         |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "QA"
}
```

### Respostas de sucesso

HTTP **201**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [GroupResponse](workspace-contracts.md#groupresponse).

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "QA",
    "description": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "roleIds": [],
    "memberCount": 0
  },
  "message": "Grupo criado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## GET /api/v1/workspaces/{workspaceId}/groups/{groupId}

### Objetivo e acesso

Consultar grupo.

**OpenAPI operationId:** `getWorkspaceGroup`. Acesso: `workspace.read`.

Consultar dados do mesmo Workspace; buscas por ID validam tenant e membership atuais.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [GroupResponse](workspace-contracts.md#groupresponse).

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "QA",
    "description": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "roleIds": ["33333333-3333-4333-8333-333333333333"],
    "memberCount": 1
  },
  "message": "Grupo consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Leituras podem ser refeitas com política limitada após falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## PATCH /api/v1/workspaces/{workspaceId}/groups/{groupId}

### Objetivo e acesso

Alterar grupo; permission: workspace.manage_groups.

**OpenAPI operationId:** `updateWorkspaceGroup`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Description null limpa o texto. Ator precisa possuir todas as permissions das roles já associadas ao grupo. Mudança de nome não altera participantes.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name          | string       | não         | mín. 1 caracteres; máx. 100 caracteres                    |
| body   | description   | string       | não         | Aceita null.; máx. 500 caracteres                         |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "description": null
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [GroupResponse](workspace-contracts.md#groupresponse).

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "QA",
    "description": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "roleIds": ["33333333-3333-4333-8333-333333333333"],
    "memberCount": 1
  },
  "message": "Grupo atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## DELETE /api/v1/workspaces/{workspaceId}/groups/{groupId}

### Objetivo e acesso

Remover grupo e concessões; preserva membros.

**OpenAPI operationId:** `deleteWorkspaceGroup`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Remove grupo, participações e concessões coletivas, preservando membros e roles. Direitos obtidos apenas por esse grupo são perdidos na próxima requisição.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## GET /api/v1/workspaces/{workspaceId}/groups/{groupId}/members

### Objetivo e acesso

Listar participantes; sort: memberId.

**OpenAPI operationId:** `listWorkspaceGroupMembers`. Acesso: `workspace.read`.

Cada item contém memberId. Para nome/e-mail/roles, mapear IDs da lista de membros do Workspace ou consultar GET membro. Aceita page/size/sort; não aceita q/status.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                            |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                              |
| query  | sort          | string       | não         |                                                           |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`memberId,asc`; campos permitidos: memberId, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/members?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [GroupParticipantResponse](workspace-contracts.md#groupparticipantresponse).

```json
{
  "data": [
    {
      "memberId": "22222222-2222-4222-8222-222222222222"
    }
  ],
  "message": "Participantes consultados com sucesso.",
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

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/members",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Leituras podem ser refeitas com política limitada após falha transitória.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## PUT /api/v1/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}

### Objetivo e acesso

Adicionar membro ao grupo; permission: workspace.manage_groups.

**OpenAPI operationId:** `addWorkspaceGroupMember`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Adicionar é idempotente. Membro suspenso pode ter sua organização administrada, mas não ganha acesso enquanto suspenso. Membro removido é recusado. Todas as roles do grupo devem caber nas permissions do administrador.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/members/22222222-2222-4222-8222-222222222222
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/members/22222222-2222-4222-8222-222222222222",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## DELETE /api/v1/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}

### Objetivo e acesso

Remover membro do grupo; permission: workspace.manage_groups.

**OpenAPI operationId:** `removeWorkspaceGroupMember`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Remoção idempotente da participação; não remove membership nem concessões diretas. Invalidar dados do grupo e do membro.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/members/22222222-2222-4222-8222-222222222222
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/members/22222222-2222-4222-8222-222222222222",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## PUT /api/v1/workspaces/{workspaceId}/groups/{groupId}/roles/{roleId}

### Objetivo e acesso

Atribuir role ao grupo; permission: workspace.manage_groups.

**OpenAPI operationId:** `assignWorkspaceGroupRole`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Concessão idempotente ao grupo; afeta seus membros ativos na próxima requisição. Exige que o ator possua as permissions da role e das demais roles do grupo; Owner nunca é concedido por grupo.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId        | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

## DELETE /api/v1/workspaces/{workspaceId}/groups/{groupId}/roles/{roleId}

### Objetivo e acesso

Revogar role do grupo; permission: workspace.manage_groups.

**OpenAPI operationId:** `revokeWorkspaceGroupRole`. Acesso: `workspace.manage_groups`; validar também as permissions concedidas pelo grupo.

Revoga somente a concessão coletiva deste grupo. Direitos diretos ou de outros grupos continuam válidos. Vínculo ausente permanece 204.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | groupId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | roleId        | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/roles/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **204**. X-Request-Id identifica a chamada. Sem corpo; não chamar response.json().

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                       | Confirmar estado e apresentar mensagem da API.                       |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/groups/44444444-4444-4444-8444-444444444444/roles/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

### Fluxo de integração

1. Obter IDs das respostas da API, validar inputs e iniciar loading.
2. Enviar bearer e manter apenas uma submissão por formulário.
3. Aplicar sucesso e atualizar/invalidate caches incluindo workspaceId.
4. Tratar campos/permission/sessão, preservar requestId e encerrar loading.

Após timeout de mutação, consultar o estado antes de repetir POST/PATCH.
PUT/DELETE de concessões são idempotentes quanto ao vínculo; não duplicam
associações. As regras específicas acima definem os conflitos.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação, primeira versão. Não altera login/bearer/refresh. Módulos consumidores
(TestCase/Run/Defect/Governance) ainda não foram entregues; não montar
rotas para seus vínculos. Contrato HTTP/DTOs/permissions e cenários críticos
verificados pelos testes da fase; resultados consolidados no
[plano de implementação](../codex/CODEX_IMPLEMENTATION_PLAN.md). SendGrid foi
verificado com mock; testes não comprovam entrega real na caixa postal.

Atualização Fase 06 (03/10/2026): [Governança](governance-contracts.md) disponível.
Owner/Administrator têm os três novos grants; Member recebe governance.read.
Roles customizadas preservadas; endpoints de acesso mantêm payloads.
