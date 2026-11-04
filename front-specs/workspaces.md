# Workspaces, membros e convites

Disponibilidade: implementado na Fase 01. API v1; atualização: 02/10/2026.
Swagger: [localhost:3000/docs](http://localhost:3000/docs); contrato JSON em
[openapi.json](openapi.json). Ler primeiro o [fluxo e contratos comuns](workspace-contracts.md).

Os IDs dos exemplos são fictícios; substituir pelos IDs retornados pela API.
Projetos e Casos de Teste estão disponíveis; ver [índice](README.md).
Planos e Execuções disponíveis na Fase 04; [Defeitos](defect-contracts.md) na Fase 05.

## GET /api/v1/workspaces

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Listar Workspaces acessíveis; sort: name, slug, createdAt.

**OpenAPI operationId:** `listWorkspaces`. Acesso: Bearer válido; sem permission de tenant para o catálogo global/criação. A lista inclui somente Workspaces acessíveis.

Retorna somente os Workspaces com membership ativo e workspace.read. Resposta inclui memberId, isOwner e permissions atuais. Selecionar o Workspace pelo id; limpar cache/dados do escopo anterior.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                         |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------------ |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                   |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                     |
| query  | sort          | string       | não         |                                                  |
| query  | q             | string       | não         | máx. 100 caracteres                              |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`name,asc`; campos permitidos: name, slug, createdAt, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [WorkspaceResponse](workspace-contracts.md#workspaceresponse).

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Equipe de QA",
      "slug": "equipe-qa",
      "status": "ACTIVE",
      "ownerMemberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "memberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "isOwner": true,
      "permissions": [
        "workspace.read",
        "workspace.update",
        "workspace.manage_members",
        "workspace.manage_roles",
        "workspace.manage_groups",
        "field.read",
        "field.manage",
        "tag.read",
        "tag.manage",
        "attachment.read",
        "attachment.upload",
        "attachment.delete",
        "project.read",
        "project.create",
        "project.update",
        "project.archive",
        "project.manage_members",
        "project.manage_all",
        "milestone.manage",
        "environment.manage",
        "testcase.read",
        "testcase.create",
        "testcase.update",
        "testcase.archive",
        "testrun.read",
        "testrun.execute",
        "testrun.manage",
        "defect.read",
        "defect.manage",
        "governance.read",
        "governance.assess",
        "governance.manage"
      ]
    }
  ],
  "message": "Workspaces consultados com sucesso.",
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
  "instance": "/api/v1/workspaces",
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

## POST /api/v1/workspaces

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Criar Workspace e vínculo de Owner.

**OpenAPI operationId:** `createWorkspace`. Acesso: Bearer válido; sem permission de tenant para o catálogo global/criação. A lista inclui somente Workspaces acessíveis.

Cria Workspace, Owner e roles de sistema na mesma transação. Cadastro de User não cria Workspace automaticamente. Slug global único, minúsculo, 3–80 caracteres, letras/números separados por hífen. Em timeout, consultar a lista por slug antes de repetir.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                         |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------------ |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer. |

| body | name | string | sim | mín. 1 caracteres; máx. 100 caracteres |
| body | slug | string | sim | mín. 3 caracteres; máx. 80 caracteres |

```http
POST /api/v1/workspaces
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Equipe de QA",
  "slug": "equipe-qa"
}
```

### Respostas de sucesso

HTTP **201**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [WorkspaceResponse](workspace-contracts.md#workspaceresponse).

```json
{
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Equipe de QA",
    "slug": "equipe-qa",
    "status": "ACTIVE",
    "ownerMemberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "memberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "isOwner": true,
    "permissions": [
      "workspace.read",
      "workspace.update",
      "workspace.manage_members",
      "workspace.manage_roles",
      "workspace.manage_groups",
      "field.read",
      "field.manage",
      "tag.read",
      "tag.manage",
      "attachment.read",
      "attachment.upload",
      "attachment.delete",
      "project.read",
      "project.create",
      "project.update",
      "project.archive",
      "project.manage_members",
      "project.manage_all",
      "milestone.manage",
      "environment.manage",
      "testcase.read",
      "testcase.create",
      "testcase.update",
      "testcase.archive",
      "testrun.read",
      "testrun.execute",
      "testrun.manage",
      "defect.read",
      "defect.manage",
      "governance.read",
      "governance.assess",
      "governance.manage"
    ]
  },
  "message": "Workspace criado com sucesso.",
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
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                    | Confirmar estado e apresentar mensagem da API.                  |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência | Preservar requestId; confirmar estado antes de repetir mutação. |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os campos informados e tente novamente.",
  "instance": "/api/v1/workspaces",
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

## GET /api/v1/workspaces/{workspaceId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Consultar Workspace e permissions atuais.

**OpenAPI operationId:** `getWorkspace`. Acesso: `workspace.read`.

Usar permissions e isOwner para habilitar ações. Estes valores são projeções atuais; o backend autoriza novamente cada operação. Suspensão/remoção de vínculo ou Workspace não visível retorna 404.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [WorkspaceResponse](workspace-contracts.md#workspaceresponse).

```json
{
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Equipe de QA",
    "slug": "equipe-qa",
    "status": "ACTIVE",
    "ownerMemberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "memberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "isOwner": true,
    "permissions": [
      "workspace.read",
      "workspace.update",
      "workspace.manage_members",
      "workspace.manage_roles",
      "workspace.manage_groups",
      "field.read",
      "field.manage",
      "tag.read",
      "tag.manage",
      "attachment.read",
      "attachment.upload",
      "attachment.delete",
      "project.read",
      "project.create",
      "project.update",
      "project.archive",
      "project.manage_members",
      "project.manage_all",
      "milestone.manage",
      "environment.manage",
      "testcase.read",
      "testcase.create",
      "testcase.update",
      "testcase.archive",
      "testrun.read",
      "testrun.execute",
      "testrun.manage",
      "defect.read",
      "defect.manage",
      "governance.read",
      "governance.assess",
      "governance.manage"
    ]
  },
  "message": "Workspace consultado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111",
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

## PATCH /api/v1/workspaces/{workspaceId}

Atualização de 06/10/2026: catálogo com 35 permissions, incluindo testvault.* e
testcase.read/create/update/archive, testrun.read/execute/manage e defect.read/manage e governance.read/assess/manage. Campos permissions/permissionCodes podem
conter novos códigos. Administrator acompanha todos; Member ganha read; roles
customizadas exigem grants explícitos. Ver [compatibilidade](governance-contracts.md#acesso-e-compatibilidade).

### Objetivo e acesso

Alterar dados; permission: workspace.update.

**OpenAPI operationId:** `updateWorkspace`. Acesso: `workspace.update`.

PATCH aceita name e slug; ausente preserva o valor, null é rejeitado. Não aceita status, ownerMemberId ou campos futuros. Nome não pode conter somente espaços.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name          | string       | não         | mín. 1 caracteres; máx. 100 caracteres                    |
| body   | slug          | string       | não         | mín. 3 caracteres; máx. 80 caracteres                     |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Equipe de QA revisada"
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [WorkspaceResponse](workspace-contracts.md#workspaceresponse).

```json
{
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Equipe de QA revisada",
    "slug": "equipe-qa",
    "status": "ACTIVE",
    "ownerMemberId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Workspace atualizado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111",
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

## POST /api/v1/workspaces/{workspaceId}/ownership/transfer

### Objetivo e acesso

Transferir ownership; somente Owner.

**OpenAPI operationId:** `transferWorkspaceOwnership`. Acesso: Somente o Owner atual; o destino deve ser membro ativo do mesmo Workspace.

Enviar WorkspaceMember.id, não User.id. Em timeout, consultar ownerMemberId antes de repetir: o autor pode já ter perdido ownership. O antigo Owner mantém suas roles diretas/grupos; ownership não cria uma role editável.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | memberId      | uuid         | sim         | Ausente segue as regras da operação.                      |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/ownership/transfer
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "memberId": "22222222-2222-4222-8222-222222222222"
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [WorkspaceResponse](workspace-contracts.md#workspaceresponse).

```json
{
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Equipe de QA",
    "slug": "equipe-qa",
    "status": "ACTIVE",
    "ownerMemberId": "22222222-2222-4222-8222-222222222222",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Ownership transferido com sucesso.",
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
| 409     | WORKSPACE_OWNER_INACTIVE                                                | Destinatário não está ativo na identidade    | Escolher outro membro ativo.                                         |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/ownership/transfer",
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

## GET /api/v1/workspaces/{workspaceId}/members

### Objetivo e acesso

Listar membros; sort: joinedAt, status.

**OpenAPI operationId:** `listWorkspaceMembers`. Acesso: `workspace.read`.

Busca por substring de nome/e-mail. roleId considera roles diretas e herdadas; groupId filtra participação. Filtros combinados usam interseção; cada membro aparece uma vez. Roles podem aparecer com várias origens DIRECT/GROUP. Owner é isOwner, não uma role chamada Owner.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                            |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                              |
| query  | sort          | string       | não         |                                                           |
| query  | q             | string       | não         | máx. 100 caracteres                                       |
| query  | status        | string       | não         | Valores: "ACTIVE", "SUSPENDED", "REMOVED"                 |
| query  | roleId        | uuid         | não         |                                                           |
| query  | groupId       | uuid         | não         |                                                           |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`joinedAt,asc`; campos permitidos: joinedAt, status, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/members?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [MemberResponse](workspace-contracts.md#memberresponse).

```json
{
  "data": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "userId": "88888888-8888-4888-8888-888888888888",
      "status": "ACTIVE",
      "joinedAt": "2026-10-02T09:00:00.000-03:00",
      "user": {
        "id": "88888888-8888-4888-8888-888888888888",
        "email": "membro@example.com",
        "displayName": "Pessoa de exemplo",
        "status": "ACTIVE",
        "emailVerifiedAt": "2026-10-02T09:00:00.000-03:00"
      },
      "isOwner": false,
      "roles": [
        {
          "id": "33333333-3333-4333-8333-333333333333",
          "name": "Analistas",
          "source": "DIRECT",
          "groupId": null
        }
      ],
      "groups": [
        {
          "id": "44444444-4444-4444-8444-444444444444",
          "name": "QA"
        }
      ]
    }
  ],
  "message": "Membros consultados com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/members",
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

## GET /api/v1/workspaces/{workspaceId}/members/{memberId}

### Objetivo e acesso

Consultar membro, roles e grupos.

**OpenAPI operationId:** `getWorkspaceMember`. Acesso: `workspace.read`.

user.status representa a identidade global; status no vínculo representa aquele Workspace. Sem cargo, Regular/Guest ou lastActivityAt nesta entrega. Exibir somente as colunas disponíveis.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [MemberResponse](workspace-contracts.md#memberresponse).

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "userId": "88888888-8888-4888-8888-888888888888",
    "status": "ACTIVE",
    "joinedAt": "2026-10-02T09:00:00.000-03:00",
    "user": {
      "id": "88888888-8888-4888-8888-888888888888",
      "email": "membro@example.com",
      "displayName": "Pessoa de exemplo",
      "status": "ACTIVE",
      "emailVerifiedAt": "2026-10-02T09:00:00.000-03:00"
    },
    "isOwner": false,
    "roles": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Analistas",
        "source": "DIRECT",
        "groupId": null
      }
    ],
    "groups": [
      {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "QA"
      }
    ]
  },
  "message": "Membro consultado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222",
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

## PATCH /api/v1/workspaces/{workspaceId}/members/{memberId}

### Objetivo e acesso

Suspender/reativar vínculo; permission: workspace.manage_members.

**OpenAPI operationId:** `updateWorkspaceMemberStatus`. Acesso: `workspace.manage_members`.

ACTIVE reativa vínculo suspenso; SUSPENDED revoga acesso na próxima requisição. Não excluir User nem revogar sessões dos demais Workspaces. REMOVED exige novo convite, não PATCH ACTIVE. Owner protegido: transferir primeiro.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | status        | string       | sim         | Valores: "ACTIVE", "SUSPENDED"                            |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "status": "SUSPENDED"
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [MemberResponse](workspace-contracts.md#memberresponse).

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "userId": "88888888-8888-4888-8888-888888888888",
    "status": "SUSPENDED",
    "joinedAt": "2026-10-02T09:00:00.000-03:00",
    "user": {
      "id": "88888888-8888-4888-8888-888888888888",
      "email": "membro@example.com",
      "displayName": "Pessoa de exemplo",
      "status": "ACTIVE",
      "emailVerifiedAt": "2026-10-02T09:00:00.000-03:00"
    },
    "isOwner": false,
    "roles": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Analistas",
        "source": "DIRECT",
        "groupId": null
      }
    ],
    "groups": [
      {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "QA"
      }
    ]
  },
  "message": "Status do membro atualizado com sucesso.",
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
| 409     | WORKSPACE_OWNER_PROTECTED / WORKSPACE_MEMBER_REMOVED                    | Owner protegido ou reativação de removido    | Transferir ownership ou criar novo convite.                          |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222",
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

## DELETE /api/v1/workspaces/{workspaceId}/members/{memberId}

### Objetivo e acesso

Remover vínculo; preserva User e outros Workspaces.

**OpenAPI operationId:** `removeWorkspaceMember`. Acesso: `workspace.manage_members`.

Remoção lógica; limpa roles e grupos do vínculo e preserva identidade/auditoria. Reentrada requer novo convite e recebe somente Member. Esta operação não encerra o login global. Repetição para o mesmo vínculo permanece 204.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | memberId      | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222
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
| 409     | WORKSPACE_OWNER_PROTECTED / WORKSPACE_MEMBER_REMOVED                    | Owner protegido ou reativação de removido    | Transferir ownership ou criar novo convite.                          |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222",
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

## GET /api/v1/workspaces/{workspaceId}/invitations

### Objetivo e acesso

Listar convites; sort: createdAt, email, expiresAt; permission: workspace.manage_members.

**OpenAPI operationId:** `listWorkspaceInvitations`. Acesso: `workspace.manage_members`.

status EXPIRED é calculado por expiresAt. Pesquisa por e-mail. Lista nunca contém token, hash ou payload de envio. Atualizar a lista após criar, reenviar, cancelar ou aceitar.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                            |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                              |
| query  | sort          | string       | não         |                                                           |
| query  | q             | string       | não         | máx. 100 caracteres                                       |
| query  | status        | string       | não         | Valores: "PENDING", "ACCEPTED", "CANCELED", "EXPIRED"     |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`createdAt,asc`; campos permitidos: createdAt, email, expiresAt, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [InvitationResponse](workspace-contracts.md#invitationresponse).

```json
{
  "data": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "email": "membro@example.com",
      "status": "PENDING",
      "expiresAt": "2026-10-04T09:00:00.000-03:00",
      "invitedBy": "88888888-8888-4888-8888-888888888888",
      "acceptedAt": null,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "lastSentAt": "2026-10-02T09:00:00.000-03:00",
      "deliveryStatus": "SENT"
    }
  ],
  "message": "Convites consultados com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations",
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

## POST /api/v1/workspaces/{workspaceId}/invitations

### Objetivo e acesso

Registrar convite e enviar por SendGrid.

**OpenAPI operationId:** `createWorkspaceInvitation`. Acesso: `workspace.manage_members`.

202 confirma o registro do convite, não a entrega na caixa postal. SENT indica aceite pelo provedor; FAILED fica recuperável. Token dura 48 horas por padrão. Usuário já ativo/suspenso ou convite pendente conflita. Em timeout, consultar convites pelo e-mail antes de repetir POST.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | email         | email        | sim         | máx. 254 caracteres                                       |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "email": "membro@example.com"
}
```

### Respostas de sucesso

HTTP **202**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [InvitationResponse](workspace-contracts.md#invitationresponse).

```json
{
  "data": {
    "id": "99999999-9999-4999-8999-999999999999",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "email": "membro@example.com",
    "status": "PENDING",
    "expiresAt": "2026-10-04T09:00:00.000-03:00",
    "invitedBy": "88888888-8888-4888-8888-888888888888",
    "acceptedAt": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "lastSentAt": "2026-10-02T09:00:00.000-03:00",
    "deliveryStatus": "SENT"
  },
  "message": "Convite registrado. Consulte o status de envio.",
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
| 409     | WORKSPACE_INVITATION_PENDING / WORKSPACE_MEMBER_EXISTS                  | Convite pendente ou vínculo ativo/suspenso   | Consultar convite/membro e orientar o administrador.                 |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations",
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

## GET /api/v1/workspaces/{workspaceId}/invitations/{invitationId}

### Objetivo e acesso

Consultar estado do convite e envio.

**OpenAPI operationId:** `getWorkspaceInvitation`. Acesso: `workspace.manage_members`.

Permite confirmar registro/estado após timeout e acompanhar deliveryStatus. SENT indica aceite pelo SendGrid, sem garantia de entrega na caixa postal; não há tracking de bounce nesta fase.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | invitationId  | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations/99999999-9999-4999-8999-999999999999
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [InvitationResponse](workspace-contracts.md#invitationresponse).

```json
{
  "data": {
    "id": "99999999-9999-4999-8999-999999999999",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "email": "membro@example.com",
    "status": "PENDING",
    "expiresAt": "2026-10-04T09:00:00.000-03:00",
    "invitedBy": "88888888-8888-4888-8888-888888888888",
    "acceptedAt": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "lastSentAt": "2026-10-02T09:00:00.000-03:00",
    "deliveryStatus": "SENT"
  },
  "message": "Convite consultado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations/99999999-9999-4999-8999-999999999999",
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

## DELETE /api/v1/workspaces/{workspaceId}/invitations/{invitationId}

### Objetivo e acesso

Cancelar convite pendente.

**OpenAPI operationId:** `cancelWorkspaceInvitation`. Acesso: `workspace.manage_members`.

Cancelar invalida o token e remove a intenção de envio. ACCEPTED exige gestão do membro, não cancelamento. Cancelamento repetido permanece 204. Mensagem já aceita pelo provedor pode chegar, mas o token cancelado será recusado.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | invitationId  | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations/99999999-9999-4999-8999-999999999999
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
| 409     | WORKSPACE_INVITATION_CLOSED                                             | Convite aceito ou estado incompatível        | Administrar membro ou criar novo convite quando permitido.           |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations/99999999-9999-4999-8999-999999999999",
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

## POST /api/v1/workspaces/{workspaceId}/invitations/{invitationId}/resend

### Objetivo e acesso

Reenviar convite e invalidar token anterior.

**OpenAPI operationId:** `resendWorkspaceInvitation`. Acesso: `workspace.manage_members`.

Novo token invalida o anterior. Cooldown padrão 60 segundos, com 429 e Retry-After. Convite expirado PENDING pode ser reenviado; ACCEPTED/CANCELED não. FAILED também pode ser recuperado por reenvio. Não repetir cegamente após timeout; consultar o convite.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | invitationId  | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations/99999999-9999-4999-8999-999999999999/resend
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **202**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [InvitationResponse](workspace-contracts.md#invitationresponse).

```json
{
  "data": {
    "id": "99999999-9999-4999-8999-999999999999",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "email": "membro@example.com",
    "status": "PENDING",
    "expiresAt": "2026-10-04T09:00:00.000-03:00",
    "invitedBy": "88888888-8888-4888-8888-888888888888",
    "acceptedAt": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "lastSentAt": "2026-10-02T09:00:00.000-03:00",
    "deliveryStatus": "SENT"
  },
  "message": "Reenvio registrado. Consulte o status de envio.",
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
| 409     | WORKSPACE_INVITATION_CLOSED                                             | Convite aceito ou estado incompatível        | Administrar membro ou criar novo convite quando permitido.           |
| 429     | WORKSPACE_INVITATION_COOLDOWN                                           | Reenvio antes do prazo                       | Aguardar Retry-After.                                                |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/invitations/99999999-9999-4999-8999-999999999999/resend",
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

## POST /api/v1/invitations/accept

### Objetivo e acesso

Aceitar convite com e-mail autenticado correspondente.

**OpenAPI operationId:** `acceptWorkspaceInvitation`. Acesso: Bearer válido, usuário ativo e e-mail verificado correspondente ao convite.

Ler token do fragmento do link do e-mail e removê-lo do histórico; manter somente em memória durante cadastro/login. Cadastro e reset continuam usando seus próprios códigos. API recebe token no body, nunca em query/rota. E-mail divergente/inválido/expirado/cancelado: 400 genérico. Retry pelo mesmo usuário retorna o mesmo vínculo ativo; não reativa vínculo removido/suspenso. Depois, recarregar a lista de Workspaces.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                         |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------------ |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer. |

| body | token | string | sim | mín. 43 caracteres; máx. 43 caracteres; Token recebido por e-mail; nunca armazenar em URL da API. |

```http
POST /api/v1/invitations/accept
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "token": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [MembershipResponse](workspace-contracts.md#membershipresponse).

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "userId": "88888888-8888-4888-8888-888888888888",
    "status": "ACTIVE",
    "joinedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Convite aceito com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                       | Tratamento                                                      |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido           | Associar errors ao formulário quando presentes.                 |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                       | Seguir o guia de autenticação; não renovar em loop.             |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                              | Confirmar estado e apresentar mensagem da API.                  |
| 400     | WORKSPACE_INVITATION_INVALID                                            | Token inválido/expirado/cancelado/e-mail divergente | Solicitar novo convite; não revelar outro destinatário.         |
| 409     | WORKSPACE_MEMBER_EXISTS / WORKSPACE_MEMBER_SUSPENDED                    | Vínculo já ativo ou suspensão impeditiva            | Consultar o Workspace ou solicitar reativação administrativa.   |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência           | Preservar requestId; confirmar estado antes de repetir mutação. |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os campos informados e tente novamente.",
  "instance": "/api/v1/invitations/accept",
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
