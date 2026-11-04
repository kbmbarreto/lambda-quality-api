# Defeitos, estados e vínculos

- **Disponibilidade:** implementado, Fase 05.
- **Versão da API:** v1; atualizado em 02/10/2026.
- **Referência OpenAPI:** [openapi.json](openapi.json), ao vivo em `/docs-json`.
- **Resumo:** 9 endpoints. Ler [contratos e fluxo](defect-contracts.md).

Atualização 08/10/2026: todas as respostas DefectResponse incluem resolvedAt
nullable, definido pelo servidor; [regras de resolução e novo resumo global](defect-summary.md).
PATCH grava/preserva/invalida o marco conforme o ciclo; edições/anexos preservam.

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `listDefects`. Bearer; permission `defect.read`, com interseção entre
grants atuais de Workspace e role local. Lista todos os estados por padrão; status=ALL remove filtro. q busca title (trim 1–100); filtros status/severity/testRunCaseId são combináveis e aplicados antes de paginar/contar. Filtro testRunCaseId exige também testrun.read e origem no projeto. sort aceita sequence/title/createdAt/updatedAt, padrão sequence,asc; desempate id.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                |
| ------ | ------------- | ------------------- | ----------- | ----------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                       |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                        |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                        |
| query  | page          | number              | não         | Mínimo: 1. Máximo: 100000. Padrão: 1.                                   |
| query  | size          | number              | não         | Mínimo: 1. Máximo: 100. Padrão: 20.                                     |
| query  | sort          | string              | não         | campo,asc/desc conforme objetivo; desempate id.                         |
| query  | q             | string              | não         | Caracteres máximos: 100.                                                |
| query  | status        | string              | não         | Enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED, ALL.               |
| query  | severity      | string              | não         | Enum: TRIVIAL, MINOR, NORMAL, MAJOR, CRITICAL, BLOCKER.                 |
| query  | testRunCaseId | uuid                | não         | ID da cópia do mesmo Workspace/Project; exige testrun.read ao informar. |

Sem body. GET de detalhe não aceita query; listagem aceita somente filtros
documentados. page padrão 1 (máximo 100000), size=20 (máximo 100), sort conforme
objetivo. Lista vazia é 200/data=[], totalItems/totalPages=0, has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects?page=1&size=20
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse[]**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp e pagination.

```json
{
  "data": [
    {
      "id": "00000003-0000-4000-8000-000000000001",
      "workspaceId": "00000001-0000-4000-8000-000000000001",
      "projectId": "00000002-0000-4000-8000-000000000001",
      "sequence": 1,
      "humanId": "QA-DEF-1",
      "title": "Login falhou",
      "description": null,
      "severity": "NORMAL",
      "status": "OPEN",
      "testRunCaseId": null,
      "testRunId": null,
      "externalSystem": null,
      "externalIssueId": null,
      "externalUrl": null,
      "version": 1,
      "createdBy": "00000007-0000-4000-8000-000000000001",
      "createdAt": "2026-10-02T09:00:00.000-03:00",
      "resolvedAt": null,
      "updatedAt": "2026-10-02T09:00:00.000-03:00",
      "attachmentIds": [],
      "environmentId": null,
      "environmentSnapshot": null
    }
  ],
  "message": "Defeitos consultados com sucesso.",
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

Lista todos os estados por padrão; status=ALL remove filtro. q busca title (trim 1–100); filtros status/severity/testRunCaseId são combináveis e aplicados antes de paginar/contar. Filtro testRunCaseId exige também testrun.read e origem no projeto. sort aceita sequence/title/createdAt/updatedAt, padrão sequence,asc; desempate id.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.            |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                    |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.          |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.       |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                  |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita. |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.  |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects",
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

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Lista todos os estados por padrão; status=ALL remove filtro. q busca title (trim 1–100); filtros status/severity/testRunCaseId são combináveis e aplicados antes de paginar/contar. Filtro testRunCaseId exige também testrun.read e origem no projeto. sort aceita sequence/title/createdAt/updatedAt, padrão sequence,asc; desempate id.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `createDefect`. Bearer; permission `defect.manage`, com interseção entre
grants atuais de Workspace e role local. Cria OPEN/version=1, sequence imutável por projeto; severity ausente é NORMAL. Pode incluir testRunCaseId opcional/nulo; vínculo exige testrun.read e resultado atual FAILED. attachmentIds ausente/[] não associa; IDs não vazios exigem attachment.read e arquivo ativo do Workspace. Criação é atômica.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                                                     |
| ------ | ------------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                                                            |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| body   | description   | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000. Ausente mantém no PATCH; null limpa; máximo 10000 caracteres. |
| body   | severity      | string              | não         | Enum: TRIVIAL, MINOR, NORMAL, MAJOR, CRITICAL, BLOCKER.                                                                      |
| body   | attachmentIds | string[]            | não         | Itens máximos: 100. UUID v4 distintos; padrão []; não aceita null.                                                           |
| body   | title         | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 250. Trim; null/vazio inválidos.                                                  |
| body   | testRunCaseId | uuid                | não         | Aceita null. ID da cópia do mesmo Workspace/Project; exige testrun.read ao informar.                                         |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "title": "Login falhou",
  "description": null,
  "severity": "NORMAL",
  "testRunCaseId": null,
  "attachmentIds": []
}
```

### Respostas de sucesso

HTTP **201**, application/json, Cache-Control: no-store, X-Request-Id.
Location aponta para `/api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}`.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": null,
    "severity": "NORMAL",
    "status": "OPEN",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 1,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Defeito criado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Cria OPEN/version=1, sequence imutável por projeto; severity ausente é NORMAL. Pode incluir testRunCaseId opcional/nulo; vínculo exige testrun.read e resultado atual FAILED. attachmentIds ausente/[] não associa; IDs não vazios exigem attachment.read e arquivo ativo do Workspace. Criação é atômica.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.            |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                    |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.          |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.       |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                      |
| 409  | DEFECT_FAILURE_REQUIRED                                                                                                    | Origem não apresenta FAILED.                                        | Corrigir pré-condição; atualizar contexto.        |
| 409  | DEFECT_SEQUENCE_EXHAUSTED                                                                                                  | Limite de sequência do projeto.                                     | Corrigir pré-condição; atualizar contexto.        |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                  |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita. |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.  |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects",
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

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Cria OPEN/version=1, sequence imutável por projeto; severity ausente é NORMAL. Pode incluir testRunCaseId opcional/nulo; vínculo exige testrun.read e resultado atual FAILED. attachmentIds ausente/[] não associa; IDs não vazios exigem attachment.read e arquivo ativo do Workspace. Criação é atômica.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/from-failure

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `createDefectFromFailure`. Bearer; permission `defect.manage + testrun.read`, com interseção entre
grants atuais de Workspace e role local. testRunCaseId obrigatório identifica a cópia de execução com resultado FAILED (não TestCase.id). title/severity ausentes herdam titleSnapshot/severitySnapshot; description ausente herda comment do resultado atual, null limpa. Pode incluir até 100 attachmentIds, exigindo attachment.read quando não vazios. Não altera snapshot, resultado ou version do Run; admite falha de Run abortado/concluído.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                                                     |
| ------ | ------------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                                                            |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| body   | description   | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000. Ausente mantém no PATCH; null limpa; máximo 10000 caracteres. |
| body   | severity      | string              | não         | Enum: TRIVIAL, MINOR, NORMAL, MAJOR, CRITICAL, BLOCKER.                                                                      |
| body   | attachmentIds | string[]            | não         | Itens máximos: 100. UUID v4 distintos; padrão []; não aceita null.                                                           |
| body   | title         | string              | não         | Caracteres mínimos: 1. Caracteres máximos: 250. Trim; null/vazio inválidos.                                                  |
| body   | testRunCaseId | uuid                | sim         | ID da cópia do mesmo Workspace/Project; exige testrun.read ao informar.                                                      |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/from-failure
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "testRunCaseId": "00000004-0000-4000-8000-000000000001"
}
```

### Respostas de sucesso

HTTP **201**, application/json, Cache-Control: no-store, X-Request-Id.
Location aponta para `/api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}`.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": "Painel não abriu.",
    "severity": "MAJOR",
    "status": "OPEN",
    "testRunCaseId": "00000004-0000-4000-8000-000000000001",
    "testRunId": "00000005-0000-4000-8000-000000000001",
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 1,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Defeito criado a partir da falha com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

testRunCaseId obrigatório identifica a cópia de execução com resultado FAILED (não TestCase.id). title/severity ausentes herdam titleSnapshot/severitySnapshot; description ausente herda comment do resultado atual, null limpa. Pode incluir até 100 attachmentIds, exigindo attachment.read quando não vazios. Não altera snapshot, resultado ou version do Run; admite falha de Run abortado/concluído.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.            |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                    |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.          |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.       |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                      |
| 409  | DEFECT_FAILURE_REQUIRED                                                                                                    | Origem não apresenta FAILED.                                        | Corrigir pré-condição; atualizar contexto.        |
| 409  | DEFECT_SEQUENCE_EXHAUSTED                                                                                                  | Limite de sequência do projeto.                                     | Corrigir pré-condição; atualizar contexto.        |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                  |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita. |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.  |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/from-failure",
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

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

testRunCaseId obrigatório identifica a cópia de execução com resultado FAILED (não TestCase.id). title/severity ausentes herdam titleSnapshot/severitySnapshot; description ausente herda comment do resultado atual, null limpa. Pode incluir até 100 attachmentIds, exigindo attachment.read quando não vazios. Não altera snapshot, resultado ou version do Run; admite falha de Run abortado/concluído.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `getDefect`. Bearer; permission `defect.read`, com interseção entre
grants atuais de Workspace e role local. Retorna metadados e IDs ativos de anexos. testRunId é derivado da origem para navegação via API de execução, que exige testrun.read. Bytes/metadados privados do arquivo usam a biblioteca com attachment.read. Origem permanece mesmo se o resultado atual do Run mudar.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras         |
| ------ | ------------- | ------------------- | ----------- | -------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado. |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado. |
| path   | defectId      | uuid                | sim         | Conforme contrato compartilhado. |

Sem body. GET de detalhe não aceita query; listagem aceita somente filtros
documentados. page padrão 1 (máximo 100000), size=20 (máximo 100), sort conforme
objetivo. Lista vazia é 200/data=[], totalItems/totalPages=0, has*=false.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": null,
    "severity": "NORMAL",
    "status": "OPEN",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 1,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Defeito consultado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Retorna metadados e IDs ativos de anexos. testRunId é derivado da origem para navegação via API de execução, que exige testrun.read. Bytes/metadados privados do arquivo usam a biblioteca com attachment.read. Origem permanece mesmo se o resultado atual do Run mudar.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.            |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                    |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.          |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.       |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                  |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita. |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.  |

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001",
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

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Retorna metadados e IDs ativos de anexos. testRunId é derivado da origem para navegação via API de execução, que exige testrun.read. Bytes/metadados privados do arquivo usam a biblioteca com attachment.read. Origem permanece mesmo se o resultado atual do Run mudar.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}

Atualização de 09/10/2026: aceita comment opcional, trim 1–10000, inclusive
atualização isolada com version. Mudança e evento são transacionais.
[Contrato completo, erros e fluxo de comentários/histórico](defect-history.md).

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `updateDefect`. Bearer; permission `defect.manage`, com interseção entre
grants atuais de Workspace e role local. Altera title/description/severity/status; exige ao menos um campo além de version. Campo ausente mantém, description=null limpa. Permite qualquer estado do enum, incluindo reabrir para OPEN; status auditado. Apenas status atual, com version atual, é no-op. Origem/sequence/projeto não são editáveis.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                                                     |
| ------ | ------------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                                                                            |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| path   | defectId      | uuid                | sim         | Conforme contrato compartilhado.                                                                                             |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Inteiro >=1; versão atual do Defect, não do Run.                                              |
| body   | title         | string              | não         | Caracteres mínimos: 1. Caracteres máximos: 250. Trim; null/vazio inválidos.                                                  |
| body   | description   | string              | não         | Aceita null. Caracteres mínimos: 0. Caracteres máximos: 10000. Ausente mantém no PATCH; null limpa; máximo 10000 caracteres. |
| body   | severity      | string              | não         | Enum: TRIVIAL, MINOR, NORMAL, MAJOR, CRITICAL, BLOCKER.                                                                      |
| body   | status        | string              | não         | Enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED.                                                                         |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
PATCH /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1,
  "title": "Falha no login de QA",
  "description": "Painel não abriu.",
  "severity": "MAJOR",
  "status": "IN_PROGRESS"
}
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Falha no login de QA",
    "description": "Painel não abriu.",
    "severity": "MAJOR",
    "status": "IN_PROGRESS",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 2,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Defeito atualizado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Altera title/description/severity/status; exige ao menos um campo além de version. Campo ausente mantém, description=null limpa. Permite qualquer estado do enum, incluindo reabrir para OPEN; status auditado. Apenas status atual, com version atual, é no-op. Origem/sequence/projeto não são editáveis.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                     |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.           |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.        |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                       |
| 409  | DEFECT_VERSION_CONFLICT                                                                                                    | Version desatualizada.                                              | Reconsultar defeito e conciliar antes de reenviar. |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita.  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:defect-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O defeito foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001",
  "code": "DEFECT_VERSION_CONFLICT",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.
Repetições são no-op somente nos cenários descritos acima, com version atual;
version antiga conflita mesmo se o estado desejado já está presente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Altera title/description/severity/status; exige ao menos um campo além de version. Campo ausente mantém, description=null limpa. Permite qualquer estado do enum, incluindo reabrir para OPEN; status auditado. Apenas status atual, com version atual, é no-op. Origem/sequence/projeto não são editáveis.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}/external-link

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `linkDefectExternalIssue`. Bearer; permission `defect.manage`, com interseção entre
grants atuais de Workspace e role local. Grava ou substitui a tríade externalSystem/externalIssueId/externalUrl, obrigatória junta. URL HTTP/HTTPS absoluta sem credenciais, até 2048 caracteres; strings system/issueId trim. Apenas referência manual: sem chamada remota, verificação de existência ou sincronização.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo           | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                                                  |
| ------ | --------------- | ------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| header | Authorization   | Bearer access token | sim         | Token em memória.                                                                                         |
| path   | workspaceId     | uuid                | sim         | Conforme contrato compartilhado.                                                                          |
| path   | projectId       | uuid                | sim         | Conforme contrato compartilhado.                                                                          |
| path   | defectId        | uuid                | sim         | Conforme contrato compartilhado.                                                                          |
| body   | version         | number              | sim         | Mínimo: 1. Máximo: 2147483647. Inteiro >=1; versão atual do Defect, não do Run.                           |
| body   | externalSystem  | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 50. Trim; null/vazio inválidos.                                |
| body   | externalIssueId | string              | sim         | Caracteres mínimos: 1. Caracteres máximos: 250. Trim; null/vazio inválidos.                               |
| body   | externalUrl     | uri                 | sim         | Caracteres máximos: 2048. HTTP/HTTPS absoluto sem credenciais; sem espaços/controles/backslash; não trim. |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/external-link
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1,
  "externalSystem": "Azure DevOps",
  "externalIssueId": "123",
  "externalUrl": "https://dev.azure.com/example/QA/_workitems/edit/123"
}
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": null,
    "severity": "NORMAL",
    "status": "OPEN",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": "Azure DevOps",
    "externalIssueId": "123",
    "externalUrl": "https://dev.azure.com/example/QA/_workitems/edit/123",
    "version": 2,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Referência externa registrada com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Grava ou substitui a tríade externalSystem/externalIssueId/externalUrl, obrigatória junta. URL HTTP/HTTPS absoluta sem credenciais, até 2048 caracteres; strings system/issueId trim. Apenas referência manual: sem chamada remota, verificação de existência ou sincronização.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                     |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.           |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.        |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                       |
| 409  | DEFECT_VERSION_CONFLICT                                                                                                    | Version desatualizada.                                              | Reconsultar defeito e conciliar antes de reenviar. |
| 400  | VALIDATION_ERROR                                                                                                           | URL/esquema/credenciais ou tríade inválidos no DTO.                 | Corrigir pré-condição; atualizar contexto.         |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita.  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:defect-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O defeito foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/external-link",
  "code": "DEFECT_VERSION_CONFLICT",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Grava ou substitui a tríade externalSystem/externalIssueId/externalUrl, obrigatória junta. URL HTTP/HTTPS absoluta sem credenciais, até 2048 caracteres; strings system/issueId trim. Apenas referência manual: sem chamada remota, verificação de existência ou sincronização.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}/external-link

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `unlinkDefectExternalIssue`. Bearer; permission `defect.manage`, com interseção entre
grants atuais de Workspace e role local. Limpa juntos os três campos externos. Envia body JSON com version no DELETE. Ausência prévia é no-op somente com version atual.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                        |
| ------ | ------------- | ------------------- | ----------- | ------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                               |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | defectId      | uuid                | sim         | Conforme contrato compartilhado.                                                |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Inteiro >=1; versão atual do Defect, não do Run. |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
DELETE /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/external-link
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 2
}
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": null,
    "severity": "NORMAL",
    "status": "OPEN",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 3,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Referência externa removida com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Limpa juntos os três campos externos. Envia body JSON com version no DELETE. Ausência prévia é no-op somente com version atual.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                     |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.           |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.        |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                       |
| 409  | DEFECT_VERSION_CONFLICT                                                                                                    | Version desatualizada.                                              | Reconsultar defeito e conciliar antes de reenviar. |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita.  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:defect-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O defeito foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/external-link",
  "code": "DEFECT_VERSION_CONFLICT",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.
Repetições são no-op somente nos cenários descritos acima, com version atual;
version antiga conflita mesmo se o estado desejado já está presente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Limpa juntos os três campos externos. Envia body JSON com version no DELETE. Ausência prévia é no-op somente com version atual.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}/attachments

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `addDefectAttachment`. Bearer; permission `defect.manage + attachment.read`, com interseção entre
grants atuais de Workspace e role local. Associa arquivo privado ativo do mesmo Workspace. Até 100 vínculos totais por defeito, inclusive arquivos excluídos logicamente ainda vinculados. Associação existente é no-op com version atual, desde que arquivo disponível. Não concede upload/delete nem publica bytes; download exige attachment.read.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                        |
| ------ | ------------- | ------------------- | ----------- | ------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                               |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | defectId      | uuid                | sim         | Conforme contrato compartilhado.                                                |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Inteiro >=1; versão atual do Defect, não do Run. |
| body   | attachmentId  | uuid                | sim         | Conforme contrato compartilhado.                                                |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
POST /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/attachments
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 1,
  "attachmentId": "00000006-0000-4000-8000-000000000001"
}
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": null,
    "severity": "NORMAL",
    "status": "OPEN",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 2,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [
      "00000006-0000-4000-8000-000000000001"
    ],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Anexo associado ao defeito com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Associa arquivo privado ativo do mesmo Workspace. Até 100 vínculos totais por defeito, inclusive arquivos excluídos logicamente ainda vinculados. Associação existente é no-op com version atual, desde que arquivo disponível. Não concede upload/delete nem publica bytes; download exige attachment.read.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                     |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.           |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.        |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                       |
| 409  | DEFECT_VERSION_CONFLICT                                                                                                    | Version desatualizada.                                              | Reconsultar defeito e conciliar antes de reenviar. |
| 409  | DEFECT_ATTACHMENT_LIMIT                                                                                                    | Já há 100 vínculos.                                                 | Corrigir pré-condição; atualizar contexto.         |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita.  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:defect-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O defeito foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/attachments",
  "code": "DEFECT_VERSION_CONFLICT",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.
Repetições são no-op somente nos cenários descritos acima, com version atual;
version antiga conflita mesmo se o estado desejado já está presente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Associa arquivo privado ativo do mesmo Workspace. Até 100 vínculos totais por defeito, inclusive arquivos excluídos logicamente ainda vinculados. Associação existente é no-op com version atual, desde que arquivo disponível. Não concede upload/delete nem publica bytes; download exige attachment.read.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}/attachments/{attachmentId}

Atualização 04/10/2026: DefectResponse inclui environmentId e environmentSnapshot. POST, from-failure e PATCH aceitam environmentId opcional/nulo; GET list aceita filtro environmentId. Herança, validação, versão e snapshots estão em [ambiente no defeito](defect-analytics.md#ambiente-no-cadastro-de-defeitos--endpoints-existentes). Demais operações preservam ambiente e retornam os novos campos.

### Objetivo e acesso

**operationId:** `removeDefectAttachment`. Bearer; permission `defect.manage`, com interseção entre
grants atuais de Workspace e role local. Remove somente vínculo, não apaga arquivo. Envia body JSON com version no DELETE; vínculo ausente é no-op com version atual. Pode desvincular arquivo excluído logicamente. Não exige attachment.delete nem attachment.read.

workspaceId/projectId vêm de Workspace/Projetos; defectId da consulta/criação
deste guia; testRunCaseId e testRunId de [execuções](execution.md), attachmentId
da [biblioteca privada](workspace-attachments.md). IDs são UUID v4; timestamps com offset -03:00.
Projeto arquivado permite leitura e bloqueia escritas com PROJECT_ARCHIVED.
Recursos buscados fora do escopo são 404, sem revelar outros tenants/projetos.
Remoção de vínculo ausente segue o no-op descrito no objetivo.

### Requisição

| Local  | Campo         | Tipo/formato        | Obrigatório | Padrão, limites e regras                                                        |
| ------ | ------------- | ------------------- | ----------- | ------------------------------------------------------------------------------- |
| header | Authorization | Bearer access token | sim         | Token em memória.                                                               |
| path   | workspaceId   | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | projectId     | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | defectId      | uuid                | sim         | Conforme contrato compartilhado.                                                |
| path   | attachmentId  | uuid                | sim         | Conforme contrato compartilhado.                                                |
| body   | version       | number              | sim         | Mínimo: 1. Máximo: 2147483647. Inteiro >=1; versão atual do Defect, não do Run. |

Content-Type application/json, máximo 32 KiB. Campos extras e query de mutação
são rejeitados. Campos opcionais não nulos rejeitam null; veja regras específicas
de ausência/nulo no objetivo e nos [contratos](defect-contracts.md).

```http
DELETE /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/attachments/00000006-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json

{
  "version": 2
}
```

### Respostas de sucesso

HTTP **200**, application/json, Cache-Control: no-store, X-Request-Id.
data: **DefectResponse**, todos os campos/nulos detalhados em
[contratos](defect-contracts.md#defectresponse). meta contém requestId/timestamp.

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": null,
    "severity": "NORMAL",
    "status": "OPEN",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "version": 3,
    "createdBy": "00000007-0000-4000-8000-000000000001",
    "createdAt": "2026-10-02T09:00:00.000-03:00",
    "resolvedAt": null,
    "updatedAt": "2026-10-02T09:00:00.000-03:00",
    "attachmentIds": [],
    "environmentId": null,
    "environmentSnapshot": null
  },
  "message": "Anexo removido do defeito com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

Remove somente vínculo, não apaga arquivo. Envia body JSON com version no DELETE; vínculo ausente é no-op com version atual. Pode desvincular arquivo excluído logicamente. Não exige attachment.delete nem attachment.read.

### Erros e tratamento no front-end

| HTTP | code                                                                                                                       | Quando ocorre                                                       | Tratamento esperado                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| 400  | VALIDATION_ERROR                                                                                                           | UUID/DTO/query inválidos, campos extras.                            | Associar errors[].field ao formulário.             |
| 401  | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Token/sessão inválidos.                                             | Aplicar fluxo de autenticação.                     |
| 403  | AUTH_FORBIDDEN                                                                                                             | Grant/capability ou acesso ao arquivo/execução insuficientes.       | Atualizar permissões; manter formulário.           |
| 404  | RESOURCE_NOT_FOUND                                                                                                         | Defeito/origem/arquivo fora do escopo, ausente ou arquivo excluído. | Atualizar lista sem buscar em outro tenant.        |
| 409  | PROJECT_ARCHIVED                                                                                                           | Projeto arquivado bloqueia escrita.                                 | Atualizar contexto e acesso.                       |
| 409  | DEFECT_VERSION_CONFLICT                                                                                                    | Version desatualizada.                                              | Reconsultar defeito e conciliar antes de reenviar. |
| 413  | PAYLOAD_TOO_LARGE                                                                                                          | JSON >32 KiB.                                                       | Reduzir payload.                                   |
| 500  | INTERNAL_ERROR                                                                                                             | Falha inesperada.                                                   | Preservar requestId; confirmar estado de escrita.  |
| 503  | SERVICE_UNAVAILABLE                                                                                                        | Infraestrutura indisponível.                                        | GET pode repetir com backoff; confirmar escrita.   |

```json
{
  "type": "urn:lambdaquality:problem:defect-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O defeito foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/attachments/00000006-0000-4000-8000-000000000001",
  "code": "DEFECT_VERSION_CONFLICT",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-02T09:00:00.000-03:00"
}
```

Preservar requestId e usar HTTP/code, sem depender de textos. errors é opcional
e fornece field/code/message para validação. Não renovar sessão em loop por
qualquer 401; seguir [autenticação](authentication.md). GET pode repetir com
backoff. Falha de rede/timeout não confirma rollback: consultar defeito/lista
antes de repetir mutação. Criação não tem chave idempotente e pode duplicar.
Repetições são no-op somente nos cenários descritos acima, com version atual;
version antiga conflita mesmo se o estado desejado já está presente.

### Fluxo de integração

1. Carregar escopo, permissions e IDs; para escrita existente ler version.
2. Iniciar loading, enviar os campos documentados e impedir dupla submissão.
3. Aplicar data/version e invalidar cache por Workspace/Project/defectId.
4. Atualizar listas/filtros; navegar à execução ou biblioteca apenas com
   suas permissions. Tratar validação/conflito/sessão e encerrar loading.

Remove somente vínculo, não apaga arquivo. Envia body JSON com version no DELETE; vínculo ausente é no-op com version atual. Pode desvincular arquivo excluído logicamente. Não exige attachment.delete nem attachment.read.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- Criação na Fase 05, primeira versão do endpoint.
- Consumidor integra novos campos/estados/version; [contratos](defect-contracts.md)
  explicam IDs humanos, origem e acesso a arquivos.
- Migration `202610020005_defects` antes da API; catálogo passa a 29 permissions,
  com defect.read/manage. Atualizar grants customizados e cache de acesso.
- Referência externa manual; esta fase não sincroniza issues nem executa SDK externo.
- Verificação: HTTP e MySQL 8.4 real, concorrência, isolamento, upgrade e preservação
  de snapshots; [decisões e resultados](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).

## Indicadores por mês, projeto e ambiente — leitura adicional

[GET defects analytics](defect-analytics.md#get-apiv1workspacesworkspaceiddefectsanalytics) é o 10º endpoint de Defeitos; consulte o guia para contratos dos gráficos e especificação da área de Ambientes para o front.

## Tabela inicial consolidada — 06/10/2026

Nova [listagem GET /api/v1/defects](defect-inventory.md), sem seleção obrigatória
de Workspace, preservando acesso atual por projeto. Rotas de detalhe/mutação
continuam scoped. Ver [tarefas de interface](product-improvements.md).
