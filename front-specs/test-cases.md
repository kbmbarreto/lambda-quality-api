# Casos de Teste e Suítes — guia por endpoint

Disponível na Fase 03, API v1; atualizado em 03/10/2026. São 26 endpoints.
Leia os [contratos compartilhados](test-case-contracts.md) para modelos,
validação e controle de versão. Exemplos usam dados fictícios.

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites

### Objetivo e contexto

Suítes consultadas com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `listTestSuites`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Consulta apenas recursos do escopo autorizado.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `GET`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId, todos UUID v4 obrigatórios.
Query: page inteiro 1–100000 (default 1), size inteiro 1–100 (default 20), q texto trim 1–100; sort campo,asc/desc; desempate UUID. Suítes: sort name/position/createdAt (default position,asc); status ACTIVE/ARCHIVED/ALL (default ACTIVE); parentSuiteId UUID v4; root true/false. root=true não pode combinar com o filtro de suíte/pai. Filtros/contagens precedem paginação. Lista vazia e página excedente retornam 200 e data=[].
Body: Sem body. Query conforme regras acima.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites?page=1&size=20
Authorization: Bearer <accessToken>

```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é array com meta.pagination.

```json
{
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "parentSuiteId": null,
      "name": "Login",
      "description": null,
      "position": 1,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "archivedAt": null
    }
  ],
  "message": "Suítes consultadas com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites

### Objetivo e contexto

Suíte criada com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `createTestSuite`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.create`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: name obrigatório: texto trim 1–100; description opcional/nulo até 10000; parentSuiteId opcional/nulo (raiz), UUID v4 de suíte ativa do projeto. Position é calculada ao final dos irmãos ativos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Login"
}
```

### Respostas de sucesso

HTTP **201**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Location aponta para test-suites/{id} criado.
data é SuiteResponse.

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "parentSuiteId": null,
    "name": "Login",
    "description": null,
    "position": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null
  },
  "message": "Suíte criada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_SUITE_ARCHIVED / TEST_SUITE_CYCLE / TEST_SUITE_NOT_EMPTY                                                              | Suíte arquivada, ciclo ou filhos/casos ativos    | Rever pai/conteúdo antes da operação   |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites/order

### Objetivo e contexto

Suítes ordenadas com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `reorderTestSuites`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Substitui a ordem completa dos irmãos ativos.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PUT`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: parentSuiteId obrigatório UUID v4 ativo ou null; ids obrigatório array com todos os irmãos ativos uma única vez, até 10000 IDs. [] válido somente para conjunto vazio.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/order
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "parentSuiteId": null,
  "ids": [
    "33333333-3333-4333-8333-333333333333"
  ]
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é array completo, sem paginação.

```json
{
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "parentSuiteId": null,
      "name": "Login",
      "description": null,
      "position": 1,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "archivedAt": null
    }
  ],
  "message": "Suítes ordenadas com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_SUITE_ARCHIVED / TEST_SUITE_CYCLE / TEST_SUITE_NOT_EMPTY                                                              | Suíte arquivada, ciclo ou filhos/casos ativos    | Rever pai/conteúdo antes da operação   |
| 400  | TEST_ORDER_INVALID                                                                                                         | Posição ou conjunto de IDs inválido              | Recarregar ordem e corrigir            |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/order",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites/{suiteId}

### Objetivo e contexto

Suíte consultada com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `getTestSuite`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Consulta apenas recursos do escopo autorizado.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `GET`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/suiteId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: Sem body necessário; {} permitido em comandos. GET não possui body e não aceita query, salvo listagens.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>

```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é SuiteResponse.

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "parentSuiteId": null,
    "name": "Login",
    "description": null,
    "position": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null
  },
  "message": "Suíte consultada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites/{suiteId}

### Objetivo e contexto

Suíte atualizada com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `updateTestSuite`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PATCH`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/suiteId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: name opcional, texto trim 1–100; description opcional/nulo até 10000. Ausência preserva campo; null limpa description. Não altera pai/posição.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Login atualizado"
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é SuiteResponse.

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "parentSuiteId": null,
    "name": "Login atualizado",
    "description": null,
    "position": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null
  },
  "message": "Suíte atualizada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_SUITE_ARCHIVED / TEST_SUITE_CYCLE / TEST_SUITE_NOT_EMPTY                                                              | Suíte arquivada, ciclo ou filhos/casos ativos    | Rever pai/conteúdo antes da operação   |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites/{suiteId}/move

### Objetivo e contexto

Suíte movida com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `moveTestSuite`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/suiteId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: parentSuiteId obrigatório: UUID v4 ativo do mesmo projeto ou null (raiz). position opcional inteiro >=1 até N+1; padrão final dos irmãos de destino. Não move entre projetos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333/move
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "parentSuiteId": null,
  "position": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é SuiteResponse.

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "parentSuiteId": null,
    "name": "Login",
    "description": null,
    "position": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null
  },
  "message": "Suíte movida com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_SUITE_ARCHIVED / TEST_SUITE_CYCLE / TEST_SUITE_NOT_EMPTY                                                              | Suíte arquivada, ciclo ou filhos/casos ativos    | Rever pai/conteúdo antes da operação   |
| 400  | TEST_ORDER_INVALID                                                                                                         | Posição ou conjunto de IDs inválido              | Recarregar ordem e corrigir            |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333/move",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-suites/{suiteId}/archive

### Objetivo e contexto

Suíte arquivada com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `archiveTestSuite`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Arquiva preservando registros e vínculos; não altera snapshots de execuções existentes.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.archive`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/suiteId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: Sem body necessário; {} permitido em comandos. GET não possui body e não aceita query, salvo listagens.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333/archive
Authorization: Bearer <accessToken>
Content-Type: application/json

{}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é SuiteResponse.

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "parentSuiteId": null,
    "name": "Login",
    "description": null,
    "position": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Suíte arquivada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_SUITE_ARCHIVED / TEST_SUITE_CYCLE / TEST_SUITE_NOT_EMPTY                                                              | Suíte arquivada, ciclo ou filhos/casos ativos    | Rever pai/conteúdo antes da operação   |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-suites/33333333-3333-4333-8333-333333333333/archive",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases

### Objetivo e contexto

Casos consultados com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `listTestCases`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Consulta apenas recursos do escopo autorizado.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `GET`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId, todos UUID v4 obrigatórios.
Query: page inteiro 1–100000 (default 1), size inteiro 1–100 (default 20), q texto trim 1–100; sort campo,asc/desc; desempate UUID. Casos: sort sequence/title/createdAt/updatedAt (default sequence,asc); status DRAFT/ACTIVE/DEPRECATED/ARCHIVED/ALL (default não arquivados); suiteId/tagId UUID v4; root true/false; priority e automationStatus nos enums. root=true não pode combinar com o filtro de suíte/pai. Filtros/contagens precedem paginação. Lista vazia e página excedente retornam 200 e data=[].
Body: Sem body. Query conforme regras acima.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases?page=1&size=20
Authorization: Bearer <accessToken>

```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é array com meta.pagination.

```json
{
  "data": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "suiteId": null,
      "sequence": 1,
      "title": "Validar login",
      "description": null,
      "preconditions": null,
      "postconditions": null,
      "severity": "NORMAL",
      "priority": "MEDIUM",
      "status": "DRAFT",
      "type": "FUNCTIONAL",
      "layer": "E2E",
      "behavior": null,
      "automationStatus": "MANUAL",
      "createdBy": "99999999-9999-4999-8999-999999999999",
      "version": 1,
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "archivedAt": null,
      "humanId": "CASES-1",
      "steps": [],
      "tagIds": [],
      "attachmentIds": [],
      "customFields": []
    }
  ],
  "message": "Casos consultados com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/summary

### Objetivo e acesso

Implementado em 03/10/2026, API v1; operação OpenAPI `getTestCaseSummary`.
Consulta o inventário do projeto em uma requisição para os números da árvore
do repositório. Bearer obrigatório, Workspace e membro ativos, projeto visível
com permission efetiva `testcase.read`, pela interseção dos grants atuais com
as capabilities locais. Projetos arquivados continuam consultáveis. Os IDs
vêm da seleção atual de Workspace/Projeto; nenhuma busca autoriza apenas por UUID.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer accessToken | Sim | Sessão válida |
| header | X-Request-Id | UUID v4 | Não | Gerado quando ausente |
| rota | workspaceId | UUID v4 | Sim | Workspace autorizado |
| rota | projectId | UUID v4 | Sim | Projeto do Workspace autorizado |
| query | status | DRAFT, ACTIVE, DEPRECATED, ARCHIVED ou ALL | Não | Ausente exclui arquivados; ALL inclui todos; demais valores selecionam a situação exata |

Sem body. Não aceita paginação (`page`, `size`), busca (`q`), ordenação
(`sort`), filtro de suíte (`suiteId`, `root`) nem outros filtros da listagem.
Campos inesperados, enum vazio/inválido e repetição de status são rejeitados.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/summary?status=ALL
Authorization: Bearer <accessToken>
X-Request-Id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, X-Request-Id e
Cache-Control: no-store. Envelope data/message/meta, sem meta.pagination.
`data.totalCases` conta todos os casos do projeto na seleção de situação.
`data.suites` contém grupos `{suiteId, totalCases}`: UUID v4 para a suíte ou
null para casos sem suíte; cada contagem inclui somente associação direta.
Os números são inteiros não negativos; grupos vazios são omitidos.
Pais não incluem descendentes. A soma dos grupos equivale a totalCases.
Não depender da ordem dos grupos para montar a árvore.

```json
{
  "data": {
    "totalCases": 8,
    "suites": [
      { "suiteId": null, "totalCases": 1 },
      { "suiteId": "33333333-3333-4333-8333-333333333333", "totalCases": 7 }
    ]
  },
  "message": "Contagens de casos consultadas com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-03T17:00:00.000-03:00"
  }
}
```

Projeto sem casos selecionados:

```json
{
  "data": { "totalCases": 0, "suites": [] },
  "message": "Contagens de casos consultadas com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-03T17:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado no front |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID/query/enum inválido ou campo inesperado | Corrigir parâmetros; associar errors[].field e preservar requestId |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido | Seguir fluxo de autenticação |
| 403 | AUTH_FORBIDDEN | Projeto visível, sem testcase.read efetiva | Atualizar permissions e impedir a ação |
| 404 | RESOURCE_NOT_FOUND | Workspace/projeto ausente ou fora do acesso atual | Não inferir existência; observar fallback em implantação antiga |
| 500 | INTERNAL_ERROR | Falha inesperada | Preservar requestId para diagnóstico |
| 503 | SERVICE_UNAVAILABLE | Banco/concorrência indisponível | Repetir consulta com espera limitada |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/summary",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-03T17:00:00.000-03:00"
}
```

Consulta idempotente; falha de rede/timeout não é resposta HTTP. Repetir
consultas com espera limitada e cancelar ao trocar de projeto. Nenhuma
mutação é produzida por esta rota.

### Fluxo de integração

1. Carregar todas as páginas de suítes do escopo e consultar summary com o
   status selecionado; a busca textual filtra somente a lista de casos.
2. Criar um mapa por suiteId; ausência de grupo equivale a zero. Usar o grupo
   null para casos sem suíte e a contagem direta para a suíte selecionada.
3. Somar grupos dos descendentes no front para o total da pasta, uma única
   vez por suíte. totalCases já é o inventário total do projeto.
4. Invalidar contagens ao criar, mover, arquivar/restaurar ou alterar a
   situação dos casos; manter cache por workspaceId/projectId/status.
5. Encerrar loading, cancelar consultas e descartar respostas do escopo
   anterior ao sair do projeto; tratar erros conforme o contrato acima.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo da entrega:** criação aditiva em 03/10/2026, primeira versão.
- **Mudança:** nova rota estática registrada antes de `:caseId`; listagem e
  rotas de cadastro/move preservam seus contratos.
- **Impacto no consumidor:** substituir as consultas size=1 por uma summary.
  Recarregar o front após disponibilizar a API para detectar a nova rota.
- **Migração:** nenhuma alteração ou migração de banco necessária.
- **Compatibilidade:** em servidores antigos, 404 nesta rota opcional ou o
  400 específico do guard legado que interpreta summary como UUID de caso
  pode ativar fallback: listagem `page=1&size=1&root=true` e uma consulta
  `size=1&suiteId={id}` por suíte, lendo meta.pagination.totalItems e
  preservando status. Carregar todas as páginas de suítes e limitar a três
  consultas simultâneas; cancelar ao sair do projeto. O 404 opcional não
  aciona atualização de acesso nem impede abrir casos. Outros erros 400
  seguem validação normal. Nas APIs com esta rota, 404 conserva seu
  significado de recurso fora do escopo; o fallback também preserva a
  autorização das listagens existentes.
- **Limitações conhecidas:** associação direta, sem totais recursivos,
  nomes/árvore, passos ou vínculos. Suítes vazias não geram grupos.
- **Verificação:** casos sem suíte, árvore pai/filho, suítes vazias, situações,
  projeto arquivado, autenticação/grants e isolamento com HTTP/banco real;
  resultados em [decisões](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases

### Objetivo e contexto

Caso criado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `createTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.create`; intersectar role local com grants atuais.
Create/clone com attachmentIds exige também attachment.read.
Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: title obrigatório trim 1–250; demais propriedades e defaults em [CreateCaseInput](test-case-contracts.md#entradas-de-casos). Arrays steps/tagIds/attachmentIds/customFields opcionais, padrão []. Obrigatoriedade personalizada vale desde a criação.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Validar login"
}
```

### Respostas de sucesso

HTTP **201**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Location aponta para test-cases/{id} criado.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso criado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | CUSTOM_FIELD_REQUIRED / CUSTOM_FIELD_VALUE_INVALID                                                                         | Obrigatório ausente ou valor incompatível        | Corrigir conforme definição atual      |
| 409  | TEST_CASE_SEQUENCE_EXHAUSTED                                                                                               | Limite inteiro da sequência atingido             | Interromper criação neste projeto      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}

### Objetivo e contexto

Caso consultado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `getTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Consulta apenas recursos do escopo autorizado.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `GET`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: Sem body necessário; {} permitido em comandos. GET não possui body e não aceita query, salvo listagens.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>

```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso consultado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}

### Objetivo e contexto

Caso atualizado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `updateTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PATCH`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647; title opcional trim 1–250; propriedades de definição opcionais, sem defaults; customFields opcional faz merge por fieldId, null remove. Detalhes em [entradas](test-case-contracts.md#entradas-de-casos). suiteId, steps, tags, anexos, IDs e sequence não são aceitos aqui.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1,
  "title": "Login atualizado",
  "automationStatus": "AUTOMATED"
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Login atualizado",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "AUTOMATED",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso atualizado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | CUSTOM_FIELD_REQUIRED / CUSTOM_FIELD_VALUE_INVALID                                                                         | Obrigatório ausente ou valor incompatível        | Corrigir conforme definição atual      |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/move

### Objetivo e contexto

Caso movido com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `moveTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro >=1; suiteId obrigatório UUID v4 de suíte ativa do mesmo projeto ou null. Preserva sequence e definição.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/move
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1,
  "suiteId": "33333333-3333-4333-8333-333333333333"
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": "33333333-3333-4333-8333-333333333333",
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso movido com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | TEST_ORDER_INVALID                                                                                                         | Posição ou conjunto de IDs inválido              | Recarregar ordem e corrigir            |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/move",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/clone

### Objetivo e contexto

Caso clonado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `cloneTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Cria definição independente com nova sequência e IDs; arquivos são referências existentes.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.create + testcase.read`; intersectar role local com grants atuais.
Create/clone com attachmentIds exige também attachment.read.
Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: title opcional trim 1–250 (padrão título original); suiteId opcional UUID v4 ativo ou null (padrão suíte original). Novo UUID, sequence, version=1, status=DRAFT; IDs de passos novos. Copia valores ativos e vínculos existentes. source pode estar arquivado.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/clone
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Cópia",
  "suiteId": null
}
```

### Respostas de sucesso

HTTP **201**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Location aponta para test-cases/{id} criado.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 2,
    "title": "Cópia",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 1,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-2",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso clonado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | CUSTOM_FIELD_REQUIRED / CUSTOM_FIELD_VALUE_INVALID                                                                         | Obrigatório ausente ou valor incompatível        | Corrigir conforme definição atual      |
| 409  | TEST_CASE_SEQUENCE_EXHAUSTED                                                                                               | Limite inteiro da sequência atingido             | Interromper criação neste projeto      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/clone",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/archive

### Objetivo e contexto

Caso arquivado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `archiveTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Arquiva preservando registros e vínculos; não altera snapshots de execuções existentes.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.archive`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647, igual ao último CaseResponse.version. Sem outros campos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/archive
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "ARCHIVED",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": "2026-10-02T09:00:00.000-03:00",
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso arquivado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/archive",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/restore

### Objetivo e contexto

Caso restaurado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `restoreTestCase`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Reativa preservando sequence/createdBy e exige suíte ativa e campos obrigatórios atuais.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.archive`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro >=1; status obrigatório DRAFT/ACTIVE/DEPRECATED; suiteId opcional/nulo (padrão original, deve estar ativo); customFields opcional faz merge e permite preencher novos obrigatórios. Exige caso arquivado.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/restore
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 2,
  "status": "ACTIVE",
  "suiteId": null
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "ACTIVE",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 3,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Caso restaurado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | CUSTOM_FIELD_REQUIRED / CUSTOM_FIELD_VALUE_INVALID                                                                         | Obrigatório ausente ou valor incompatível        | Corrigir conforme definição atual      |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/restore",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/steps

### Objetivo e contexto

Passos consultados com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `listTestSteps`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Consulta apenas recursos do escopo autorizado.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `GET`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: Sem body necessário; {} permitido em comandos. GET não possui body e não aceita query, salvo listagens.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps
Authorization: Bearer <accessToken>

```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é array completo, sem paginação.

```json
{
  "data": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "testCaseId": "44444444-4444-4444-8444-444444444444",
      "position": 1,
      "action": "Abrir formulário",
      "testData": null,
      "expectedResult": "Formulário exibido"
    }
  ],
  "message": "Passos consultados com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/steps

### Objetivo e contexto

Passo adicionado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `addTestStep`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `POST`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro >=1; action obrigatório trim 1–10000; testData/expectedResult opcionais/nulos até 10000; position opcional inteiro 1–1001 e dentro de 1..N+1. Máximo 1000 passos no caso.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1,
  "action": "Abrir formulário",
  "expectedResult": "Formulário exibido",
  "position": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "workspaceId": "11111111-1111-4111-8111-111111111111",
        "projectId": "22222222-2222-4222-8222-222222222222",
        "testCaseId": "44444444-4444-4444-8444-444444444444",
        "position": 1,
        "action": "Abrir formulário",
        "testData": null,
        "expectedResult": "Formulário exibido"
      }
    ],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Passo adicionado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | TEST_ORDER_INVALID                                                                                                         | Posição ou conjunto de IDs inválido              | Recarregar ordem e corrigir            |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/steps/order

### Objetivo e contexto

Passos ordenados com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `reorderTestSteps`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Substitui a ordem completa dos passos, preservando seus IDs.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PUT`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro >=1; ids obrigatório array com todos os passos atuais uma única vez, até 1000 IDs; [] para caso sem passos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps/order
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 2,
  "ids": [
    "55555555-5555-4555-8555-555555555555"
  ]
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 3,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "workspaceId": "11111111-1111-4111-8111-111111111111",
        "projectId": "22222222-2222-4222-8222-222222222222",
        "testCaseId": "44444444-4444-4444-8444-444444444444",
        "position": 1,
        "action": "Abrir formulário",
        "testData": null,
        "expectedResult": "Formulário exibido"
      }
    ],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Passos ordenados com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | TEST_ORDER_INVALID                                                                                                         | Posição ou conjunto de IDs inválido              | Recarregar ordem e corrigir            |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps/order",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/steps/{stepId}

### Objetivo e contexto

Passo atualizado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `updateTestStep`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PATCH`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId/stepId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro >=1; action opcional trim 1–10000; testData/expectedResult opcionais/nulos até 10000. Ausência preserva, null limpa texto opcional; posição usa reorder.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PATCH /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 2,
  "action": "Abrir formulário atualizado"
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 3,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "workspaceId": "11111111-1111-4111-8111-111111111111",
        "projectId": "22222222-2222-4222-8222-222222222222",
        "testCaseId": "44444444-4444-4444-8444-444444444444",
        "position": 1,
        "action": "Abrir formulário atualizado",
        "testData": null,
        "expectedResult": "Formulário exibido"
      }
    ],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Passo atualizado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps/55555555-5555-4555-8555-555555555555",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/steps/{stepId}

### Objetivo e contexto

Passo removido com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `deleteTestStep`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `DELETE`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId/stepId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647, igual ao último CaseResponse.version. Sem outros campos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps/55555555-5555-4555-8555-555555555555
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Passo removido com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/steps/55555555-5555-4555-8555-555555555555",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/tags/{tagId}

### Objetivo e contexto

Tag vinculada com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `linkTestCaseTag`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PUT`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId/tagId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647, igual ao último CaseResponse.version. Sem outros campos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/tags/66666666-6666-4666-8666-666666666666
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": ["66666666-6666-4666-8666-666666666666"],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Tag vinculada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/tags/66666666-6666-4666-8666-666666666666",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/tags/{tagId}

### Objetivo e contexto

Tag desvinculada com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `unlinkTestCaseTag`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `DELETE`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId/tagId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647, igual ao último CaseResponse.version. Sem outros campos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/tags/66666666-6666-4666-8666-666666666666
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Tag desvinculada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/tags/66666666-6666-4666-8666-666666666666",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/attachments/{attachmentId}

### Objetivo e contexto

Anexo vinculado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `linkTestCaseAttachment`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update + attachment.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PUT`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId/attachmentId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647, igual ao último CaseResponse.version. Sem outros campos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/attachments/77777777-7777-4777-8777-777777777777
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": ["77777777-7777-4777-8777-777777777777"],
    "customFields": []
  },
  "message": "Anexo vinculado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/attachments/77777777-7777-4777-8777-777777777777",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/attachments/{attachmentId}

### Objetivo e contexto

Anexo desvinculado com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `unlinkTestCaseAttachment`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update + attachment.read`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `DELETE`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId/attachmentId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro 1–2147483647, igual ao último CaseResponse.version. Sem outros campos.
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/attachments/77777777-7777-4777-8777-777777777777
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": []
  },
  "message": "Anexo desvinculado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/attachments/77777777-7777-4777-8777-777777777777",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Consulta/arquivo/vínculo pode ser repetido consultando antes o estado; comandos de caso exigem version atual.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## PUT /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/{caseId}/custom-fields

### Objetivo e contexto

Valores atualizados com sucesso. Disponível na Fase 03, API v1; operação OpenAPI `replaceTestCaseFieldValues`.
Usada no repositório de testes e na edição/consulta de suítes e casos.
Atualize a seleção e as listagens do projeto após sucesso.

### Acesso e segurança

Bearer obrigatório; WorkspaceMember ativo, Workspace ativo e projeto visível.
Permissions: `testcase.update`; intersectar role local com grants atuais.

Todas as referências são validadas dentro do Workspace/Projeto da URL.
Projeto arquivado permite consultas e bloqueia escritas.

### Requisição

Método `PUT`; caminho completo no título. Headers: Authorization;
Content-Type application/json nas mutações; X-Request-Id UUID v4 opcional.
Rota: workspaceId/projectId/caseId, todos UUID v4 obrigatórios.
Query: Não aceita query. Paginação/filtros/ordenação de consulta não se aplicam.
Body: version obrigatório inteiro >=1; customFields obrigatório array até 1000 objetos {fieldId: UUID v4, value: escalar ou null}, sem IDs duplicados. Substitui valores ativos, preserva valores de definições arquivadas. Tipos e required em [valores](test-case-contracts.md#valores-personalizados).
Campos inesperados são rejeitados; detalhes e tipos das respostas no
[contrato](test-case-contracts.md#modelos-de-resposta).

```http
PUT /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/custom-fields
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "version": 1,
  "customFields": [
    {
      "fieldId": "88888888-8888-4888-8888-888888888888",
      "value": "Valor"
    }
  ]
}
```

### Respostas de sucesso

HTTP **200**; JSON data/message/meta; X-Request-Id, Cache-Control: no-store.
Sem Location; IDs estão no data.
data é CaseResponse completo, com version atual, passos e vínculos.

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "projectId": "22222222-2222-4222-8222-222222222222",
    "suiteId": null,
    "sequence": 1,
    "title": "Validar login",
    "description": null,
    "preconditions": null,
    "postconditions": null,
    "severity": "NORMAL",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "type": "FUNCTIONAL",
    "layer": "E2E",
    "behavior": null,
    "automationStatus": "MANUAL",
    "createdBy": "99999999-9999-4999-8999-999999999999",
    "version": 2,
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "archivedAt": null,
    "humanId": "CASES-1",
    "steps": [],
    "tagIds": [],
    "attachmentIds": [],
    "customFields": [
      {
        "fieldId": "88888888-8888-4888-8888-888888888888",
        "value": "Valor"
      }
    ]
  },
  "message": "Valores atualizados com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                    | Tratamento no front                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | DTO, JSON, UUID, query ou enum inválido          | Associar errors aos campos             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido                           | Seguir fluxo de autenticação           |
| 403  | AUTH_FORBIDDEN                                                                                                             | Ação sem grants/capability                       | Atualizar permissions e ocultar ação   |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Tenant/projeto/recurso/referência fora do escopo | Limpar seleção; não inferir existência |
| 409  | PROJECT_ARCHIVED                                                                                                           | Mutação em projeto arquivado                     | Exibir modo consulta                   |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON excede 32 KiB                               | Reduzir payload e dividir alterações   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada                                 | Preservar requestId; consultar estado  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Concorrência/infraestrutura                      | Consultar estado antes de repetir      |
| 409  | TEST_CASE_VERSION_CONFLICT / TEST_CASE_ARCHIVED / TEST_CASE_NOT_ARCHIVED                                                   | Versão obsoleta ou estado incompatível           | Recarregar caso e reconciliar edição   |
| 400  | CUSTOM_FIELD_REQUIRED / CUSTOM_FIELD_VALUE_INVALID                                                                         | Obrigatório ausente ou valor incompatível        | Corrigir conforme definição atual      |

```json
{
  "type": "urn:lambdaquality:problem:test-case-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O caso foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/44444444-4444-4444-8444-444444444444/custom-fields",
  "code": "TEST_CASE_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Em VALIDATION_ERROR, associe `errors[].field` ao formulário, incluindo campos
aninhados, e preserve requestId. Esta operação não é idempotente; não repita cegamente após timeout.
Em falha de rede ou 503, consulte o servidor antes de repetir mutações.
Criação/clone sem resposta confirmada pode ter sido efetivada; procure o caso
antes de criar novamente. 409 de versão exige reconciliar os dados atuais.

### Fluxo de integração

1. Selecione Workspace/Projeto; carregue permissions, catálogos e versão atual.
2. Inicie loading e impeça submissão simultânea do mesmo formulário.
3. Envie a requisição; aplique o data retornado e sua version; invalide caches
   usando workspaceId/projectId e IDs relacionados (suíte/caso/catálogos).
4. Trate erros por code/HTTP; mantenha edição local para reconciliação;
   encerre loading. Trocar escopo limpa dados do escopo anterior.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Criação de endpoint na Fase 03; primeira versão, sem migração de payload
anterior. Adaptar UI à autorização atual, archive, version e campos obrigatórios.
Shared steps/parameters e execução não fazem parte da entrega.
Verificação: suíte Vitest/Supertest/MySQL da Fase 03; resultados e limitações
em [decisões da fase](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## Importação Azure DevOps — 06/10/2026

Nova rota [CSV](azure-test-case-import.md): importa atomicamente no projeto aberto,
sem suíte, com BDD na descrição e passos preservados. Veja [tarefas de interface](product-improvements.md).
