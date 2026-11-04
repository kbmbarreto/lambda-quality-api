# Biblioteca de anexos privados

Disponibilidade: implementado na Fase 01. API v1; atualização: 04/10/2026.
Swagger: [localhost:3000/docs](http://localhost:3000/docs); contrato JSON em
[openapi.json](openapi.json). Ler primeiro o [fluxo e contratos comuns](workspace-contracts.md).

Os IDs dos exemplos são fictícios; substituir pelos IDs retornados pela API.
Projetos e Casos de Teste estão disponíveis; ver [índice](README.md).
Planos e Execuções disponíveis na Fase 04; [Defeitos](defect-contracts.md) na Fase 05.

## Armazenamento Oracle OCI — 04/10/2026

Atualização de **05/10/2026**: falhas de configuração, PEM, fingerprint, permissões
IAM ou comunicação com a OCI não impedem a API de iniciar nem bloqueiam os outros
módulos. O armazenamento é inicializado na primeira operação de arquivo; o bucket
precisa ser privado antes de qualquer acesso aos bytes. Sem fallback em disco.
Biblioteca, metadados e exclusão lógica continuam disponíveis quando o banco funciona.

Todos os anexos da biblioteca, inclusive evidências vinculadas a casos de teste,
execuções, defeitos e governança, passam a ter seus bytes no **Oracle OCI Object
Storage**, com bucket privado verificado antes da primeira operação de arquivo. O banco mantém os metadados, IDs, checksum e vínculos. A API recebe o
arquivo em memória, grava na OCI e transmite downloads por stream após verificar
bearer/membership/permissão. Nenhum arquivo novo é salvo em disco no servidor.

O front continua enviando `FormData` com `file` para a API e baixando por `fetch`
com bearer. Não há upload direto do navegador à OCI, novas rotas, URL pública,
redirecionamento, credenciais OCI ou `storageKey` na resposta. Não converter o
arquivo para base64. O limite e a validação de MIME/conteúdo permanecem iguais.
Após upload bem-sucedido, usar o ID retornado nas rotas de associação existentes.

Em falha da OCI no upload/abertura do download, tratar
`503 ATTACHMENT_STORAGE_UNAVAILABLE`, preservar formulário e `requestId`, sem
renovar sessão nem tentar outro destino de upload. Se o stream de download
interromper após os headers, descartar o Blob incompleto e permitir nova
tentativa de leitura; não haverá outro envelope JSON nesse ponto. Após resposta
incerta no upload, consultar a biblioteca antes de repetir a mutação.

A implantação precisa migrar os arquivos locais existentes antes de liberar
a nova versão; essa é uma tarefa de operação, sem alteração dos IDs no front.
Configuração Docker/chave/bucket e ferramenta de migração estão no
[guia do backend](../codex/OCI_STORAGE_IMPLEMENTATION_DECISIONS.md).

## GET /api/v1/workspaces/{workspaceId}/attachments

### Objetivo e acesso

Listar biblioteca; sort: createdAt, originalName, sizeBytes; permission: attachment.read.

**OpenAPI operationId:** `listWorkspaceAttachments`. Acesso: `attachment.read`.

Lista somente anexos não excluídos. Pesquisa por nome original. Sem URLs públicas/storageKey na resposta e sem vínculos a TestCase/Defect/Governance nesta fase.

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
`createdAt,asc`; campos permitidos: createdAt, originalName, sizeBytes, com asc/desc e desempate
por ID. Lista vazia ou página além do total retorna array vazio e totais reais.
Rejeitar query/body extras. q, quando disponível, aceita 1–100 caracteres.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments?page=1&size=20
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC. meta.pagination contém totais e navegação.

Campos de cada item: [AttachmentResponse](workspace-contracts.md#attachmentresponse).

```json
{
  "data": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "originalName": "resultado.txt",
      "contentType": "text/plain",
      "sizeBytes": 18,
      "checksum": "9d1f7ff982f42e0ebb3b042fb6874bd795f17b352efa48823786afbcc287d472",
      "uploadedBy": "88888888-8888-4888-8888-888888888888",
      "createdAt": "2026-10-02T09:00:00.000-03:00"
    }
  ],
  "message": "Anexos consultados com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments",
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

Atualização de 04/10/2026: armazenamento externo Oracle OCI. Rota, payload,
DTO, permissões e envelope preservados; o front mantém as chamadas existentes.
Metadados e vínculos continuam no banco, com os mesmos IDs. Os bytes legados
exigem a migração operacional descrita acima. A exclusão continua lógica; a
limpeza física posterior usa a OCI. Testes cobrem integridade, isolamento,
compensação de upload, streams e escopo da limpeza. Em 04/10/2026, o adapter/SDK
também foi validado na OCI real: bucket privado, upload, download, remoção e
migração do anexo legado, preservando os IDs. Testes HTTP de autorização usam
armazenamento simulado e MySQL real.

## POST /api/v1/workspaces/{workspaceId}/attachments

### Objetivo e acesso

Em falha de PEM/configuração/permissão/disponibilidade OCI, a API permanece ativa
e este upload retorna `503 ATTACHMENT_STORAGE_UNAVAILABLE`.

Upload PNG/JPEG/PDF/TXT/CSV; permission: attachment.upload.

**OpenAPI operationId:** `uploadWorkspaceAttachment`. Acesso: `attachment.upload`.

Enviar somente um arquivo no campo file, sem outros campos multipart. Limite padrão 10 MiB, configurável no servidor. MIME permitido e conteúdo devem corresponder: PNG/JPEG/PDF/TXT/CSV UTF-8. Arquivo vazio é recusado. Não enviar SVG/HTML/executável. Deixar o navegador definir o boundary de FormData.

### Requisição

| Local          | Campo         | Tipo/formato    | Obrigatório | Padrão, limites e regras                                  |
| -------------- | ------------- | --------------- | ----------- | --------------------------------------------------------- |
| header         | Authorization | Bearer JWT      | sim         | Access token em memória; refresh nunca é bearer.          |
| rota           | workspaceId   | uuid            | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| body           | file          | binary          | sim         | Ausente segue as regras da operação.                      |
| body multipart | file          | arquivo binário | sim         | Um arquivo; sem campos extras; padrão até 10 MiB.         |

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data; boundary=<gerado-pelo-navegador>
```

### Respostas de sucesso

HTTP **201**. X-Request-Id identifica a chamada. Location aponta para o recurso registrado. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [AttachmentResponse](workspace-contracts.md#attachmentresponse).

```json
{
  "data": {
    "id": "77777777-7777-4777-8777-777777777777",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "originalName": "resultado.txt",
    "contentType": "text/plain",
    "sizeBytes": 18,
    "checksum": "9d1f7ff982f42e0ebb3b042fb6874bd795f17b352efa48823786afbcc287d472",
    "uploadedBy": "88888888-8888-4888-8888-888888888888",
    "createdAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Anexo enviado com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                      | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido          | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                      | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível                   | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente       | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 409     | RESOURCE_CONFLICT ou conflito específico abaixo                         | Duplicidade/invariante                             | Confirmar estado e apresentar mensagem da API.                       |
| 400     | ATTACHMENT_FILE_REQUIRED / ATTACHMENT_EMPTY / ATTACHMENT_TYPE_INVALID   | Upload ausente/vazio/tipo ou conteúdo incompatível | Escolher arquivo permitido.                                          |
| 413     | PAYLOAD_TOO_LARGE                                                       | Upload maior que o limite                          | Reduzir arquivo; limite é configurável.                              |
| 503     | ATTACHMENT_STORAGE_UNAVAILABLE                                          | Storage indisponível                               | Preservar formulário; confirmar estado antes de repetir.             |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência          | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

Em `503 ATTACHMENT_STORAGE_UNAVAILABLE`, exibir `detail` em uma mensagem visível,
preservar o arquivo escolhido e os demais dados do formulário e encerrar o loading.
Não renovar token, atualizar acesso nem repetir o upload automaticamente. Não
associar o arquivo a um caso/defeito/evidência sem receber `201` e um ID de anexo.
Quando o storage falha, nenhum metadado ou vínculo de sucesso é criado. Exemplo:

```json
{
  "type": "urn:lambdaquality:problem:attachment-storage-unavailable",
  "title": "Falha ao processar solicitação",
  "status": 503,
  "detail": "Não foi possível anexar o arquivo. O serviço de armazenamento está temporariamente indisponível. Tente novamente mais tarde.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments",
  "code": "ATTACHMENT_STORAGE_UNAVAILABLE",
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "timestamp": "2026-10-05T09:00:00.000-03:00"
}
```

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments",
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

05/10/2026: modo degradado de storage; manter rotas/payloads/permissões e tratar o
novo texto de `detail` no upload. Sem migration de banco ou mudança de IDs.

Atualização de 04/10/2026: armazenamento externo Oracle OCI. Rota, payload,
DTO, permissões e envelope preservados; o front mantém as chamadas existentes.
Metadados e vínculos continuam no banco, com os mesmos IDs. Os bytes legados
exigem a migração operacional descrita acima. A exclusão continua lógica; a
limpeza física posterior usa a OCI. Testes cobrem integridade, isolamento,
compensação de upload, streams e escopo da limpeza. Em 04/10/2026, o adapter/SDK
também foi validado na OCI real: bucket privado, upload, download, remoção e
migração do anexo legado, preservando os IDs. Testes HTTP de autorização usam
armazenamento simulado e MySQL real.

## GET /api/v1/workspaces/{workspaceId}/attachments/{attachmentId}

### Objetivo e acesso

Consultar metadados do anexo; permission: attachment.read.

**OpenAPI operationId:** `getWorkspaceAttachment`. Acesso: `attachment.read`.

Metadados autorizados, sem bytes. SHA-256 é hexadecimal de 64 caracteres. IDs e UploadedBy pertencem à identidade/Workspace; não inferir URL de storage.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | attachmentId  | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments/77777777-7777-4777-8777-777777777777
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Resposta segue o envelope comum; timestamps em UTC.

Campos de cada data: [AttachmentResponse](workspace-contracts.md#attachmentresponse).

```json
{
  "data": {
    "id": "77777777-7777-4777-8777-777777777777",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "originalName": "resultado.txt",
    "contentType": "text/plain",
    "sizeBytes": 18,
    "checksum": "9d1f7ff982f42e0ebb3b042fb6874bd795f17b352efa48823786afbcc287d472",
    "uploadedBy": "88888888-8888-4888-8888-888888888888",
    "createdAt": "2026-10-02T09:00:00.000-03:00"
  },
  "message": "Anexo consultado com sucesso.",
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments/77777777-7777-4777-8777-777777777777",
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

Atualização de 04/10/2026: armazenamento externo Oracle OCI. Rota, payload,
DTO, permissões e envelope preservados; o front mantém as chamadas existentes.
Metadados e vínculos continuam no banco, com os mesmos IDs. Os bytes legados
exigem a migração operacional descrita acima. A exclusão continua lógica; a
limpeza física posterior usa a OCI. Testes cobrem integridade, isolamento,
compensação de upload, streams e escopo da limpeza. Em 04/10/2026, o adapter/SDK
também foi validado na OCI real: bucket privado, upload, download, remoção e
migração do anexo legado, preservando os IDs. Testes HTTP de autorização usam
armazenamento simulado e MySQL real.

## DELETE /api/v1/workspaces/{workspaceId}/attachments/{attachmentId}

### Objetivo e acesso

Excluir logicamente; permission: attachment.delete.

**OpenAPI operationId:** `deleteWorkspaceAttachment`. Acesso: `attachment.delete`.

Exclusão lógica: lista/download deixam de expor imediatamente. Repetição continua 204 enquanto o registro existe. Retenção física padrão 30 dias; rotina de limpeza explícita do backend. Não usar esse prazo como permissão para acessar arquivo excluído.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | attachmentId  | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
DELETE /api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments/77777777-7777-4777-8777-777777777777
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
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments/77777777-7777-4777-8777-777777777777",
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

Atualização de 04/10/2026: armazenamento externo Oracle OCI. Rota, payload,
DTO, permissões e envelope preservados; o front mantém as chamadas existentes.
Metadados e vínculos continuam no banco, com os mesmos IDs. Os bytes legados
exigem a migração operacional descrita acima. A exclusão continua lógica; a
limpeza física posterior usa a OCI. Testes cobrem integridade, isolamento,
compensação de upload, streams e escopo da limpeza. Em 04/10/2026, o adapter/SDK
também foi validado na OCI real: bucket privado, upload, download, remoção e
migração do anexo legado, preservando os IDs. Testes HTTP de autorização usam
armazenamento simulado e MySQL real.

## GET /api/v1/workspaces/{workspaceId}/attachments/{attachmentId}/download

### Objetivo e acesso

Falha de PEM/configuração/acesso OCI retorna `503 ATTACHMENT_STORAGE_UNAVAILABLE`
com `detail: "Não foi possível acessar o arquivo."`, se os headers ainda não foram
enviados. A API e as leituras de metadados permanecem disponíveis. Em transferência
já iniciada, descartar o Blob incompleto e oferecer nova tentativa de download.

Baixar arquivo privado; permission: attachment.read.

**OpenAPI operationId:** `downloadWorkspaceAttachment`. Acesso: `attachment.read`.

Retorna bytes com MIME do arquivo, Content-Disposition attachment e nosniff. Não tentar parsear sucesso como JSON; para falha, ler Problem Details. Enviar bearer por fetch, converter para Blob e criar URL temporária no navegador. Sem URL pública permanente.

### Requisição

| Local  | Campo         | Tipo/formato | Obrigatório | Padrão, limites e regras                                  |
| ------ | ------------- | ------------ | ----------- | --------------------------------------------------------- |
| header | Authorization | Bearer JWT   | sim         | Access token em memória; refresh nunca é bearer.          |
| rota   | workspaceId   | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |
| rota   | attachmentId  | uuid         | sim         | UUID v4 obtido nas consultas/criação; pertence ao escopo. |

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments/77777777-7777-4777-8777-777777777777/download
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**. X-Request-Id identifica a chamada. Arquivo binário, sem envelope JSON. Content-Type acompanha o arquivo;
Content-Disposition fornece nome para download; Cache-Control: no-store.

### Erros e tratamento no front-end

| HTTP    | code                                                                    | Quando ocorre                                | Tratamento                                                           |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 400     | VALIDATION_ERROR                                                        | Tipo, campo, UUID, enum ou query inválido    | Associar errors ao formulário quando presentes.                      |
| 401     | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_SESSION_REVOKED | Autenticação ausente/inválida                | Seguir o guia de autenticação; não renovar em loop.                  |
| 403     | AUTH_FORBIDDEN                                                          | Sem permission no escopo visível             | Atualizar capacidades e desabilitar ação; não encerrar login global. |
| 404     | RESOURCE_NOT_FOUND                                                      | Recurso/Workspace não visível ou inexistente | Limpar cache do escopo; não inferir existência em outro tenant.      |
| 503     | ATTACHMENT_STORAGE_UNAVAILABLE                                          | Storage indisponível                         | Preservar formulário; confirmar estado antes de repetir.             |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE                                    | Falha inesperada/dependência/concorrência    | Preservar requestId; confirmar estado antes de repetir mutação.      |

Os conflitos específicos só se aplicam às operações descritas nas regras
deste endpoint; consulte também a [matriz de erros](workspace-contracts.md#erros).

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/attachments/77777777-7777-4777-8777-777777777777/download",
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

Atualização de 04/10/2026: armazenamento externo Oracle OCI. Rota, payload,
DTO, permissões e envelope preservados; o front mantém as chamadas existentes.
Metadados e vínculos continuam no banco, com os mesmos IDs. Os bytes legados
exigem a migração operacional descrita acima. A exclusão continua lógica; a
limpeza física posterior usa a OCI. Testes cobrem integridade, isolamento,
compensação de upload, streams e escopo da limpeza. Em 04/10/2026, o adapter/SDK
também foi validado na OCI real: bucket privado, upload, download, remoção e
migração do anexo legado, preservando os IDs. Testes HTTP de autorização usam
armazenamento simulado e MySQL real.

Atualização Fase 06 (03/10/2026): [Governança](governance-contracts.md) disponível.
Owner/Administrator têm os três novos grants; Member recebe governance.read.
Roles customizadas preservadas; endpoints de acesso mantêm payloads.
