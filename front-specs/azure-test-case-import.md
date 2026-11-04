# Importação de casos de teste Azure DevOps

Atualização de 08/10/2026: importação autenticada sem quota geral por minuto.
Limites de CSV/payload, autorização e recibos idempotentes preservados.

Disponível na API v1 em 06/10/2026. Importação de CSV exportado do Azure Test Plans;
não importa o plano em si. operationId: importAzureDevOpsTestCases.

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-cases/import/azure-devops

### Objetivo e acesso

Bearer e permissão efetiva testcase.create no projeto. Membership ativo no Workspace,
projeto visível e ativo; IDs UUID v4 das rotas existentes. Autorização acontece antes
do processamento multipart e é conferida novamente na transação.

### Requisição

| Local | Campo | Tipo | Obrigatório | Limites/regras |
| --- | --- | --- | --- | --- |
| Rota | workspaceId, projectId | UUID v4 | sim | Mesmo escopo autorizado |
| Header | Authorization | Bearer | sim | Access token |
| Multipart | file | arquivo .csv UTF-8 | sim | Um arquivo, até 5 MiB; nenhum outro campo |

Não recebe query. Somente extensão .csv (case insensitive); XLS/XLSX recusados.
Conteúdo validado pelo parser, sem confiar no MIME. Cabeçalhos obrigatórios:
ID, Work Item Type, Title, Test Step, Step Action, Step Expected. Cabeçalhos não
repetidos; Area Path, Assigned To e State são aceitos/ignorados. Description opcional.
Cabeçalhos comparados sem distinção de caixa. Delimitador vírgula; UTF-8 com/sem BOM,
CRLF/LF, aspas duplas escapadas e quebras dentro das células são suportados.

Registro do caso: ID numérico, Work Item Type Test Case, título 1–250 caracteres.
Registros seguintes com ID/type/title vazios são passos do caso anterior. Test Step
começa em 1, consecutivo, até 1000 passos/caso; ação obrigatória e expected opcional,
até 10000 caracteres cada. Até 200 casos/10000 registros lógicos, sem IDs repetidos
no arquivo. Ações BDD iniciadas por Dado/Quando/Então/E/Mas ou Given/When/Then/And/But
são copiadas para a descrição (todas as ações daquele caso, em ordem), além dos
passos. Description é preservada antes do BDD; limite combinado 10000 caracteres.

Todos os casos usam suiteId null no projeto da rota; DRAFT, NORMAL, MEDIUM,
FUNCTIONAL, E2E, MANUAL e demais padrões de cadastro. IDs humanos/sequences são
atribuídos pelo servidor. Não importa identidade, estado, suíte ou projeto do CSV.
Campos personalizados obrigatórios existentes continuam sendo validados; se o
projeto os exigir, a importação não inventa valores e falha atomicamente.
Fórmulas/HTML são texto, sem execução; o front deve escapar a renderização.

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/import/azure-devops
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data; boundary=<gerado pelo navegador>
```

```typescript
const body = new FormData();
body.append('file', file);
await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
```

### Respostas de sucesso

HTTP 200, Cache-Control no-store, X-Request-Id. importedCount inteiro: número de
casos do recibo. alreadyImported indica se o recibo já existia; cases contém
azureId (string do CSV), id UUID local, sequence local, title e suiteId sempre null.
Nenhuma gravação parcial: casos, passos, auditoria e recibo são transacionais.

```json
{
  "data": {
    "importedCount": 1,
    "alreadyImported": false,
    "cases": [{"azureId":"5810","id":"33333333-3333-4333-8333-333333333333","sequence":1,"title":"Validar relatório financeiro","suiteId":null}]
  },
  "message": "Casos importados com sucesso.",
  "meta": {"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00"}
}
```

SHA-256 dos bytes distingue arquivos; o mesmo arquivo no mesmo projeto devolve o
recibo anterior com alreadyImported true, independentemente do nome do arquivo.
Em outro projeto é uma importação independente. Mudanças nos bytes (incluindo
quebras de linha) geram uma nova importação; não deduplica IDs Azure entre arquivos.
O recibo conserva os IDs/títulos da entrega original mesmo após editar os casos.

### Erros e tratamento no front-end

| HTTP | code | Condição | Tratamento |
| --- | --- | --- | --- |
| 400 | TEST_CASE_IMPORT_INVALID | Extensão, UTF-8, estrutura/limites CSV inválidos | Mostrar detail/registro lógico e preservar seleção |
| 400 | VALIDATION_ERROR | UUID/query/multipart extra inválido | Corrigir requisição |
| 400 | CUSTOM_FIELD_REQUIRED | Valores personalizados obrigatórios ausentes | Informar limitação e usar cadastro individual |
| 401/403 | AUTH_UNAUTHENTICATED / AUTH_FORBIDDEN | Sessão/grant inválido | Fluxo existente de acesso |
| 404 | RESOURCE_NOT_FOUND | Workspace/projeto não visível | Trocar contexto |
| 409 | PROJECT_ARCHIVED / RESOURCE_CONFLICT | Projeto arquivado/conflito | Recarregar estado |
| 413 | PAYLOAD_TOO_LARGE | Arquivo acima do limite | Escolher arquivo menor |
| 503 | SERVICE_UNAVAILABLE | Dependência indisponível | Retry limitado com mesmo arquivo |

```json
{"type":"urn:lambdaquality:problem:test-case-import-invalid","title":"Dados inválidos","status":400,"detail":"CSV inválido, registro 2: passo sem caso precedente.","instance":"/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-cases/import/azure-devops","code":"TEST_CASE_IMPORT_INVALID","requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00"}
```

### Fluxo de integração

1. Abrir importação no projeto corrente com testcase.create; aceitar apenas CSV.
2. Enviar file uma vez, mostrar loading e impedir submissão duplicada.
3. Em 200, exibir quantidade/recibo, atualizar raiz, summary e dashboard.
4. Em falha, preservar arquivo/formulário e requestId; encerrar loading.

### Alterações e compatibilidade

Rota nova, independente do cadastro existente. Não requer Azure PAT ou OCI. Sem
criação automática de planos/suítes. Retry do mesmo arquivo é idempotente. Migration
aditiva cria recibos; a validação de campos obrigatórios do Workspace é preservada.
Testes cobrem o modelo fornecido anonimizado, BDD, CSV multilinha, duplicidade,
atomicidade, autorização, projetos arquivados e isolamento em bancos reais.
