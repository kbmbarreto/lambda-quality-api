# Cofre de testes por projeto

Disponível na API v1 em 06/10/2026. Chaves e configuração são exclusivamente do
back-end. O cliente envia dados por HTTPS; o servidor cifra antes da persistência.
Usuário, senha, URL e notas são AES-256-GCM; nome, IDs, datas e version são metadados.
Não há senha/username mascarados na lista: esses campos simplesmente não aparecem.

Acesso comum: Bearer, membership ativo no Workspace, projeto visível e capability
efetiva correspondente. IDs de rota são UUID v4. Permissões dependem simultaneamente
dos grants atuais e papel no projeto; revelar requer grant explícito testvault.reveal.
VIEWER admite read/reveal quando concedidos; EDITOR/MANAGER também manage. Member
não recebe grants novos automaticamente; Administrator/Owner têm o catálogo completo.
Todos os endpoints retornam Cache-Control no-store e X-Request-Id.

## Erros comuns

| HTTP | code | Quando | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID, payload/query desconhecidos ou limites inválidos | Mostrar errors por campo |
| 400 | TEST_VAULT_ENVIRONMENT_INVALID | Produção ou ambiente inativo | Escolher ambiente ativo não produtivo |
| 401/403 | AUTH_UNAUTHENTICATED / AUTH_FORBIDDEN | Sessão ou grant inválido | Fluxo de acesso existente |
| 404 | RESOURCE_NOT_FOUND | Escopo/registro/ambiente inexistente ou oculto | Trocar contexto/recarregar lista |
| 409 | TEST_VAULT_VERSION_CONFLICT | Alteração concorrente | Recarregar metadados e reconciliar |
| 409 | PROJECT_ARCHIVED | Mutação em projeto arquivado | Usar somente leitura |
| 413 | PAYLOAD_TOO_LARGE | JSON acima do limite global 32 KiB | Reduzir conteúdo |
| 503 | TEST_VAULT_UNAVAILABLE | Chave ausente/inválida, ciphertext inválido ou falha de autenticação criptográfica | Mostrar detail, preservar formulário em memória; não logout/refresh |
| 503 | SERVICE_UNAVAILABLE | Banco/concor­rência | Confirmar estado antes de repetir mutação |

```json
{"type":"urn:lambdaquality:problem:test-vault-unavailable","title":"Falha ao processar solicitação","status":503,"detail":"O cofre está temporariamente indisponível.","instance":"/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-vault","code":"TEST_VAULT_UNAVAILABLE","requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00"}
```

Nunca persistir secrets em armazenamento do navegador, cache durável, logs, URLs
ou telemetry; apagar da memória ao ocultar/fechar/trocar contexto. Não reutilizar
`***` como password ao editar. Campo secret omitido preserva o conteúdo anterior.

## Configuração e diagnóstico — 08/10/2026

A API continua usando AES-256-GCM; chave preenchida com texto arbitrário não
é válida. TEST_VAULT_ENCRYPTION_KEYS deve ser JSON com chave de **32 bytes**
em Base64 canônico (44 caracteres incluindo `=`), associada ao ID de
TEST_VAULT_ACTIVE_KEY_ID. Uma configuração inválida mantém o restante da API
ativo e continua retornando 503 TEST_VAULT_UNAVAILABLE nas operações sensíveis.

No servidor/local, `npm run vault:check` valida a configuração sem imprimir
segredos nem consultar o banco. `npm run setup:vault-key` corrige a configuração
local do .env privado gerando uma chave com novo ID, preservando IDs anteriores
(e mantendo uma chave ativa válida sem alterações). Reiniciar a API depois;
o backend captura a configuração no startup. Guardar backup privado das chaves.
Se houver entradas antigas ilegíveis, recuperar a chave original do respectivo
ID; gerar uma nova não decifra dados anteriores nem realiza recifragem em massa.
Na Library, usar os dois valores correspondentes do .env atualizado, em variável
secret para TEST_VAULT_ENCRYPTION_KEYS; não enviar chaves ao front.

Nenhuma alteração de DTO/formulário é necessária para este reparo. O front
continua tratando 503 com detail/requestId e preservando o formulário em memória.
Os endpoints deste guia não têm quota geral de requisições autenticadas.

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-vault

### Objetivo e acesso

Listar somente metadados do cofre do projeto. Bearer e `testvault.read` efetivo no projeto.
OpenAPI: `listTestVaultEntries`. Listar não precisa da chave de criptografia. Projeto arquivado continua consultável.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| Rota | workspaceId, projectId | UUID v4 | sim | Obtidos no contexto aberto |
| Query | page / size | inteiro | não | 1 / 20; page 1–100000, size 1–100 |
| Query | q | texto | não | 1–100 caracteres; busca pelo nome |
| Query | sort | campo,asc/desc | não | name,asc; name,createdAt,updatedAt |
| Query | environmentId | UUID v4 | não | Ambiente ativo não produtivo do mesmo projeto |

Sem corpo. Não aceita status ou outros filtros.

### Respostas de sucesso

HTTP 200; X-Request-Id e no-store.

```json
{"data":[{"id":"33333333-3333-4333-8333-333333333333","workspaceId":"11111111-1111-4111-8111-111111111111","projectId":"22222222-2222-4222-8222-222222222222","environmentId":null,"name":"Conta de testes","version":1,"createdBy":"44444444-4444-4444-8444-444444444444","createdAt":"2026-10-06T10:00:00.000-03:00","updatedAt":"2026-10-06T10:00:00.000-03:00","deletedAt":null}],"message":"Registros do cofre consultados com sucesso.","meta":{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00","pagination":{"page":1,"size":20,"totalItems":1,"totalPages":1,"hasNext":false,"hasPrevious":false}}}
```

### Erros e tratamento no front-end

Aplicam-se os erros comuns acima; preservar requestId e mostrar detail/errors.
403 não autoriza revelar por outro endpoint. 503 não indica expiração da sessão.

### Fluxo de integração

1. Obter IDs e permissões do projeto aberto; iniciar loading.
2. Enviar apenas os campos documentados e impedir submissão duplicada.
3. Aplicar sucesso no escopo correto; limpar dados sensíveis ao encerrar a ação.
4. Encerrar loading, mostrar erros e confirmar o estado antes de repetir mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Endpoint novo; não altera credenciais da identidade nem dados dos demais módulos.
Migration aditiva cria a coleção cifrada. Chaves externas são necessárias apenas
para gravar/revelar dados sensíveis; a API e metadados permanecem disponíveis sem
a chave. Testes cobrem criptografia, grants atuais, isolamento, versão e auditoria.

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-vault

### Objetivo e acesso

Criar um registro com credenciais criptografadas. Bearer e `testvault.manage` efetivo no projeto.
OpenAPI: `createTestVaultEntry`. Somente projeto ativo. Location aponta à coleção do cofre; nenhum segredo é retornado. Escrita e auditoria são transacionais. Não é idempotente: após timeout, consultar lista antes de repetir.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| Rota | workspaceId, projectId | UUID v4 | sim | Obtidos no contexto aberto |
| Body | name | texto | sim | 1–100 caracteres, trim; rótulo sem segredos |
| Body | environmentId | UUID v4/null | não | Ativo e não PRODUCTION, no mesmo projeto; padrão null |
| Body | username / password | texto | sim | 0–1000 / 0–2000; espaços preservados |
| Body | url / notes | texto/null | não | Até 2048 / 10000; padrão null |

```json
{"name":"Conta de testes","environmentId":null,"username":"tester@example.com","password":"<senha de teste>","url":"https://hml.example.com","notes":"Massa para cenário de login"}
```

### Respostas de sucesso

HTTP 201; X-Request-Id e no-store.

```json
{"data":{"id":"33333333-3333-4333-8333-333333333333","workspaceId":"11111111-1111-4111-8111-111111111111","projectId":"22222222-2222-4222-8222-222222222222","environmentId":null,"name":"Conta de testes","version":1,"createdBy":"44444444-4444-4444-8444-444444444444","createdAt":"2026-10-06T10:00:00.000-03:00","updatedAt":"2026-10-06T10:00:00.000-03:00","deletedAt":null},"message":"Registro do cofre criado com sucesso.","meta":{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00"}}
```

### Erros e tratamento no front-end

Aplicam-se os erros comuns acima; preservar requestId e mostrar detail/errors.
403 não autoriza revelar por outro endpoint. 503 não indica expiração da sessão.

### Fluxo de integração

1. Obter IDs e permissões do projeto aberto; iniciar loading.
2. Enviar apenas os campos documentados e impedir submissão duplicada.
3. Aplicar sucesso no escopo correto; limpar dados sensíveis ao encerrar a ação.
4. Encerrar loading, mostrar erros e confirmar o estado antes de repetir mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Endpoint novo; não altera credenciais da identidade nem dados dos demais módulos.
Migration aditiva cria a coleção cifrada. Chaves externas são necessárias apenas
para gravar/revelar dados sensíveis; a API e metadados permanecem disponíveis sem
a chave. Testes cobrem criptografia, grants atuais, isolamento, versão e auditoria.

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-vault/{entryId}

### Objetivo e acesso

Editar metadados ou substituir integralmente os dados sensíveis. Bearer e `testvault.manage` efetivo no projeto.
OpenAPI: `updateTestVaultEntry`. Ao menos um campo mutável. secret ausente preserva credenciais, sem precisar da chave; secret:null é inválido. Enviar secret substitui todos os campos sensíveis, cifra com a chave ativa e incrementa version. Projeto arquivado recusa alteração.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| Rota | workspaceId, projectId | UUID v4 | sim | Obtidos no contexto aberto |
| Rota | entryId | UUID v4 | sim | ID da lista, mesmo Workspace/projeto |
| Body | version | inteiro | sim | 1–2147483647; versão atual |
| Body | name | texto | não | 1–100, trim |
| Body | environmentId | UUID v4/null | não | Ambiente ativo não produtivo do mesmo projeto; null remove |
| Body | secret | objeto | não | username/password obrigatórios; url/notes opcionais null; limites do POST |

```json
{"version":1,"name":"Conta atualizada","secret":{"username":"tester@example.com","password":"<nova senha de teste>","url":null,"notes":null}}
```

### Respostas de sucesso

HTTP 200; X-Request-Id e no-store.

```json
{"data":{"id":"33333333-3333-4333-8333-333333333333","workspaceId":"11111111-1111-4111-8111-111111111111","projectId":"22222222-2222-4222-8222-222222222222","environmentId":null,"name":"Conta atualizada","version":2,"createdBy":"44444444-4444-4444-8444-444444444444","createdAt":"2026-10-06T10:00:00.000-03:00","updatedAt":"2026-10-06T10:00:00.000-03:00","deletedAt":null},"message":"Registro do cofre atualizado com sucesso.","meta":{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00"}}
```

### Erros e tratamento no front-end

Aplicam-se os erros comuns acima; preservar requestId e mostrar detail/errors.
403 não autoriza revelar por outro endpoint. 503 não indica expiração da sessão.

### Fluxo de integração

1. Obter IDs e permissões do projeto aberto; iniciar loading.
2. Enviar apenas os campos documentados e impedir submissão duplicada.
3. Aplicar sucesso no escopo correto; limpar dados sensíveis ao encerrar a ação.
4. Encerrar loading, mostrar erros e confirmar o estado antes de repetir mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Endpoint novo; não altera credenciais da identidade nem dados dos demais módulos.
Migration aditiva cria a coleção cifrada. Chaves externas são necessárias apenas
para gravar/revelar dados sensíveis; a API e metadados permanecem disponíveis sem
a chave. Testes cobrem criptografia, grants atuais, isolamento, versão e auditoria.

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-vault/{entryId}/reveal

### Objetivo e acesso

Revelar os dados sensíveis em uma ação explícita auditada. Bearer e `testvault.reveal` efetivo no projeto.
OpenAPI: `revealTestVaultEntry`. Cache-Control no-store. Não recebe query ou campos adicionais. Retorna dados somente após decifrar e registrar auditoria; sem valor sensível na auditoria. Inclui projeto arquivado. Não fazer prefetch para a tabela.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| Rota | workspaceId, projectId | UUID v4 | sim | Obtidos no contexto aberto |
| Rota | entryId | UUID v4 | sim | Registro ativo no mesmo Workspace/projeto |

```json
{}
```

### Respostas de sucesso

HTTP 200; X-Request-Id e no-store.

```json
{"data":{"id":"33333333-3333-4333-8333-333333333333","version":1,"username":"tester@example.com","password":"<senha de teste>","url":"https://hml.example.com","notes":"Massa para cenário de login"},"message":"Dados do cofre consultados com sucesso.","meta":{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00"}}
```

### Erros e tratamento no front-end

Aplicam-se os erros comuns acima; preservar requestId e mostrar detail/errors.
403 não autoriza revelar por outro endpoint. 503 não indica expiração da sessão.

### Fluxo de integração

1. Obter IDs e permissões do projeto aberto; iniciar loading.
2. Enviar apenas os campos documentados e impedir submissão duplicada.
3. Aplicar sucesso no escopo correto; limpar dados sensíveis ao encerrar a ação.
4. Encerrar loading, mostrar erros e confirmar o estado antes de repetir mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Endpoint novo; não altera credenciais da identidade nem dados dos demais módulos.
Migration aditiva cria a coleção cifrada. Chaves externas são necessárias apenas
para gravar/revelar dados sensíveis; a API e metadados permanecem disponíveis sem
a chave. Testes cobrem criptografia, grants atuais, isolamento, versão e auditoria.

## DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-vault/{entryId}

### Objetivo e acesso

Excluir logicamente o registro, preservando a auditoria. Bearer e `testvault.manage` efetivo no projeto.
OpenAPI: `deleteTestVaultEntry`. Projeto ativo; marca deletedAt, incrementa version e audita. Não precisa da chave de criptografia. Registro excluído não pode ser listado, revelado ou atualizado. Repetição retorna 404; não há restauração nessa entrega.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| Rota | workspaceId, projectId | UUID v4 | sim | Obtidos no contexto aberto |
| Rota | entryId | UUID v4 | sim | Registro ativo, mesmo Workspace/projeto |
| Body | version | inteiro | sim | Versão atual 1–2147483647 |

```json
{"version":1}
```

### Respostas de sucesso

HTTP 204; X-Request-Id e no-store.

Sem corpo. A listagem exclui o registro imediatamente após o commit.

### Erros e tratamento no front-end

Aplicam-se os erros comuns acima; preservar requestId e mostrar detail/errors.
403 não autoriza revelar por outro endpoint. 503 não indica expiração da sessão.

### Fluxo de integração

1. Obter IDs e permissões do projeto aberto; iniciar loading.
2. Enviar apenas os campos documentados e impedir submissão duplicada.
3. Aplicar sucesso no escopo correto; limpar dados sensíveis ao encerrar a ação.
4. Encerrar loading, mostrar erros e confirmar o estado antes de repetir mutações.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

Endpoint novo; não altera credenciais da identidade nem dados dos demais módulos.
Migration aditiva cria a coleção cifrada. Chaves externas são necessárias apenas
para gravar/revelar dados sensíveis; a API e metadados permanecem disponíveis sem
a chave. Testes cobrem criptografia, grants atuais, isolamento, versão e auditoria.

