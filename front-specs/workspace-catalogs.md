# Campos personalizados e tags

Disponibilidade: implementado na Fase 01. API v1; atualização: 02/10/2026.
Swagger: [localhost:3000/docs](http://localhost:3000/docs); contrato JSON em
[openapi.json](openapi.json). Ler primeiro o [fluxo e contratos comuns](workspace-contracts.md).

Os IDs dos exemplos são fictícios; substituir pelos IDs retornados pela API.
Projetos e Casos de Teste estão disponíveis; ver [índice](README.md).
Planos e Execuções disponíveis na Fase 04; [Defeitos](defect-contracts.md) na Fase 05.

## GET /api/v1/workspaces/{workspaceId}/custom-fields

### Objetivo e acesso

Listar definições; sort: position, name, createdAt; permission: field.read.

**OpenAPI operationId:** `listCustomFields`. Acesso: `field.read`.

Padrão status ACTIVE; ARCHIVED consulta arquivados; ALL inclui ambos. Catálogo pode ser administrado agora; uso e validação de valores estão disponíveis na Fase 03; ver [contratos](test-case-contracts.md).

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| query  | page          | number       | não         | Padrão: 1; mín. 1; máx. 100000                            |
| query  | size          | number       | não         | Padrão: 20; mín. 1; máx. 100                              |
| query  | sort          | string       | não         |                                                           |
| query  | q             | string       | não         | máx. 100 caracteres                                       |
| query  | status        | string       | não         | Valores: "ACTIVE", "ARCHIVED", "ALL"; Padrão: "ACTIVE"    |

Paginação: page 1–100000, size 1–100 (padrões 1/20). Sort padrão
`position,asc`; campos permitidos: position, name, createdAt, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [FieldResponse](workspace-contracts.md#fieldresponse).

```json
{
  "data": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "key": "business_impact",
      "name": "Impacto",
      "description": null,
      "type": "SINGLE_SELECT",
      "target": "TEST_CASE",
      "required": false,
      "position": 1,
      "options": [
        {
          "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "label": "Alta"
        },
        {
          "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          "label": "Baixa"
        }
      ],
      "archivedAt": null,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00"
    }
  ],
  "message": "Campos consultados com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields",
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

## POST /api/v1/workspaces/{workspaceId}/custom-fields

### Objetivo e acesso

Criar definição; permission: field.manage.

**OpenAPI operationId:** `createCustomField`. Acesso: `field.manage`.

Catálogo de definições, sem valores de TestCase nesta fase. Alvo único TEST_CASE. Chave 1–80 caracteres, começa com letra minúscula, depois letras/números/underscore. Tipos TEXT/NUMBER/BOOLEAN/DATE/SINGLE_SELECT. SINGLE_SELECT exige 1–50 labels distintas, 1–100 caracteres cada; outros tipos exigem options vazio. IDs de opções são gerados pelo servidor.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                                                          |
| ------ | ------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.                                                  |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo.                                         |
| body   | key           | string       | sim         | máx. 80 caracteres                                                                                |
| body   | name          | string       | sim         | mín. 1 caracteres; máx. 100 caracteres                                                            |
| body   | description   | string       | não         | Aceita null.; máx. 500 caracteres                                                                 |
| body   | type          | string       | sim         | Valores: "TEXT", "NUMBER", "BOOLEAN", "DATE", "SINGLE_SELECT"                                     |
| body   | target        | string       | sim         | Valores: "TEST_CASE"                                                                              |
| body   | required      | boolean      | não         | Padrão: false                                                                                     |
| body   | position      | number       | não         | Padrão: 0; mín. 0; máx. 100000                                                                    |
| body   | options       | string[]     | não         | Padrão: []; máx. 50 itens; Labels distintas; somente para SINGLE_SELECT. IDs gerados na resposta. |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "key": "business_impact",
  "name": "Impacto",
  "type": "SINGLE_SELECT",
  "target": "TEST_CASE",
  "options": ["Alta", "Baixa"]
}
```

### Respostas de sucesso

HTTP **201**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [FieldResponse](workspace-contracts.md#fieldresponse).

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "business_impact",
    "name": "Impacto",
    "description": null,
    "type": "SINGLE_SELECT",
    "target": "TEST_CASE",
    "required": false,
    "position": 1,
    "options": [
      {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "label": "Alta"
      },
      {
        "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "label": "Baixa"
      }
    ],
    "archivedAt": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Campo criado com sucesso.",
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
| 400     | CUSTOM_FIELD_OPTIONS_INVALID                                            | Opções incompatíveis/duplicadas              | Corrigir labels e tipo.                                              |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields",
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

## GET /api/v1/workspaces/{workspaceId}/custom-fields/{fieldId}

### Objetivo e acesso

Consultar definição de campo.

**OpenAPI operationId:** `getCustomField`. Acesso: `field.read`.

Consulta também definições arquivadas para preservar referências. Valores e snapshots de execução ainda não são endpoints desta fase.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | fieldId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [FieldResponse](workspace-contracts.md#fieldresponse).

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "business_impact",
    "name": "Impacto",
    "description": null,
    "type": "SINGLE_SELECT",
    "target": "TEST_CASE",
    "required": false,
    "position": 1,
    "options": [
      {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "label": "Alta"
      },
      {
        "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "label": "Baixa"
      }
    ],
    "archivedAt": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Campo consultado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields/55555555-5555-4555-8555-555555555555",
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

## PATCH /api/v1/workspaces/{workspaceId}/custom-fields/{fieldId}

### Objetivo e acesso

Alterar nome, descrição, obrigatoriedade e posição; permission: field.manage.

**OpenAPI operationId:** `updateCustomField`. Acesso: `field.manage`.

Aceita somente name/description/required/position. key/type/target/options são imutáveis; campos extras dão 400. Para outra definição, criar nova chave. Campo arquivado dá 409. Ausente preserva; description null limpa; required/position null são rejeitados.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | fieldId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name          | string       | não         | mín. 1 caracteres; máx. 100 caracteres                    |
| body   | description   | string       | não         | Aceita null.; máx. 500 caracteres                         |
| body   | required      | boolean      | não         | Ausente segue as regras da operação.                      |
| body   | position      | number       | não         | mín. 0; máx. 100000                                       |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "required": true,
  "position": 1
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [FieldResponse](workspace-contracts.md#fieldresponse).

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "business_impact",
    "name": "Impacto",
    "description": null,
    "type": "SINGLE_SELECT",
    "target": "TEST_CASE",
    "required": true,
    "position": 1,
    "options": [
      {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "label": "Alta"
      },
      {
        "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "label": "Baixa"
      }
    ],
    "archivedAt": null,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Campo atualizado com sucesso.",
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
| 409     | CUSTOM_FIELD_ARCHIVED                                                   | Alteração de definição arquivada             | Criar nova definição com outra chave.                                |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields/55555555-5555-4555-8555-555555555555",
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

## POST /api/v1/workspaces/{workspaceId}/custom-fields/{fieldId}/archive

### Objetivo e acesso

Arquivar definição preservando histórico; permission: field.manage.

**OpenAPI operationId:** `archiveCustomField`. Acesso: `field.manage`.

Arquivamento preserva definição e IDs de opções. Chave permanece reservada; arquivar não permite recriar a mesma chave. Repetição retorna a definição arquivada. Sem restauração nesta fase.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | fieldId       | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields/55555555-5555-4555-8555-555555555555/archive
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [FieldResponse](workspace-contracts.md#fieldresponse).

```json
{
  "data": {
    "id": "55555555-5555-4555-8555-555555555555",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "key": "business_impact",
    "name": "Impacto",
    "description": null,
    "type": "SINGLE_SELECT",
    "target": "TEST_CASE",
    "required": false,
    "position": 1,
    "options": [
      {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "label": "Alta"
      },
      {
        "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "label": "Baixa"
      }
    ],
    "archivedAt": "2026-10-02T09:00:00.000-03:00",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Campo arquivado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/custom-fields/55555555-5555-4555-8555-555555555555/archive",
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

## GET /api/v1/workspaces/{workspaceId}/tags

### Objetivo e acesso

Listar tags; sort: name, createdAt; permission: tag.read.

**OpenAPI operationId:** `listWorkspaceTags`. Acesso: `tag.read`.

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
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [TagResponse](workspace-contracts.md#tagresponse).

```json
{
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "name": "Smoke",
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00"
    }
  ],
  "message": "Tags consultadas com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags",
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

## POST /api/v1/workspaces/{workspaceId}/tags

### Objetivo e acesso

Criar tag; permission: tag.manage.

**OpenAPI operationId:** `createWorkspaceTag`. Acesso: `tag.manage`.

Catálogo do Workspace; nome 1–100 caracteres, normalizado para unicidade. Tags de projeto e vínculos com TestCase virão com os consumidores.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name          | string       | sim         | mín. 1 caracteres; máx. 100 caracteres                    |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Smoke"
}
```

### Respostas de sucesso

HTTP **201**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [TagResponse](workspace-contracts.md#tagresponse).

```json
{
  "data": {
    "id": "66666666-6666-4666-8666-666666666666",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "Smoke",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Tag criada com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags",
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

## GET /api/v1/workspaces/{workspaceId}/tags/{tagId}

### Objetivo e acesso

Consultar tag.

**OpenAPI operationId:** `getWorkspaceTag`. Acesso: `tag.read`.

Consultar dados do mesmo Workspace; buscas por ID validam tenant e membership atuais.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | tagId         | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags/66666666-6666-4666-8666-666666666666
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [TagResponse](workspace-contracts.md#tagresponse).

```json
{
  "data": {
    "id": "66666666-6666-4666-8666-666666666666",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "Smoke",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Tag consultada com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags/66666666-6666-4666-8666-666666666666",
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

## PATCH /api/v1/workspaces/{workspaceId}/tags/{tagId}

### Objetivo e acesso

Renomear tag; permission: tag.manage.

**OpenAPI operationId:** `updateWorkspaceTag`. Acesso: `tag.manage`.

Renomear preserva ID. Nome normalizado duplicado dá 409. Não aceita Workspace/Project no body.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | tagId         | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body   | name          | string       | sim         | mín. 1 caracteres; máx. 100 caracteres                    |

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags/66666666-6666-4666-8666-666666666666
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Regressão"
}
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [TagResponse](workspace-contracts.md#tagresponse).

```json
{
  "data": {
    "id": "66666666-6666-4666-8666-666666666666",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "name": "Regressão",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Tag atualizada com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags/66666666-6666-4666-8666-666666666666",
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

## DELETE /api/v1/workspaces/{workspaceId}/tags/{tagId}

Atualização Fase 03: DELETE retorna 409 TAG_IN_USE quando houver vínculo de
caso (inclusive arquivado). Remover os vínculos antes de excluir; não repetir
sem corrigir. Contrato de sucesso 204 preservado.

### Objetivo e acesso

Remover tag; permission: tag.manage.

**OpenAPI operationId:** `deleteWorkspaceTag`. Acesso: `tag.manage`.

Não há vínculos de TestCase nesta fase. Após remoção, consulta retorna 404. Quando vínculos forem entregues, a política de exclusão será documentada na mesma entrega.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | tagId         | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags/66666666-6666-4666-8666-666666666666
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/tags/66666666-6666-4666-8666-666666666666",
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
