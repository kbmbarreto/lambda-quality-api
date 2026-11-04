# Importação JUnit, seleção em lote e inventários

- **Disponibilidade:** implementado; API v1, 08/10/2026.
- **Referência OpenAPI:** [snapshot](openapi.json) e `/docs-json`.
- **Entrega:** seis rotas novas e campos aditivos em casos de execução.
- **Pré-requisito:** aplicar `202610080001_result_imports` com `npm run migration:deploy`
  no dialeto configurado antes de iniciar esta versão. Não usar reset/db push.

## Contratos compartilhados

Bearer obrigatório, permissões atuais do Workspace em interseção com a role
local do projeto; UUID v4 em rotas e filtros de IDs. Recursos fora do escopo
retornam `404 RESOURCE_NOT_FOUND`. Workspace deve estar ativo. Leituras de
projetos arquivados são permitidas; novas escritas são bloqueadas. Todas as
respostas usam `Cache-Control: no-store`, `X-Request-Id`, envelope da API e
timestamps com offset -03:00. Não há quota geral nas operações autenticadas.

Os exemplos usam IDs fictícios:

| Nome | ID |
| --- | --- |
| workspaceId | `11111111-1111-4111-8111-111111111111` |
| projectId | `22222222-2222-4222-8222-222222222222` |
| runId / planId | `33333333-3333-4333-8333-333333333333` |
| previewId | `44444444-4444-4444-8444-444444444444` |
| runCaseId | `55555555-5555-4555-8555-555555555555` |
| testCaseId | `66666666-6666-4666-8666-666666666666` |

Os três endpoints de importação abaixo têm o prefixo
`/api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/result-imports`.
Os IDs vêm da consulta da execução; `runCaseId` é o ID da **cópia** obtido em
`.../test-runs/{runId}/cases`, diferente do `testCaseId` da definição.

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/result-imports/preview

### Objetivo e acesso

**operationId:** `previewTestRunResultImport`. Exige `testrun.read` e
`testrun.execute`, projeto ativo e execução `IN_PROGRESS` originada de plano.
O acesso é verificado antes de processar o multipart e novamente na transação.
Cria uma prévia privada sem alterar versão, resultados, comentários ou passos.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| rota | workspaceId/projectId/runId | UUID v4 | sim | Mesmo escopo da execução |
| multipart | file | arquivo `.xml` | sim | UTF-8, até 2 MiB, 1–500 elementos testcase |

Usar `FormData` com **somente** `file`, sem definir Content-Type manualmente.
Não aceita query, arquivos extras nem campos multipart adicionais. Nome do
arquivo até 250 caracteres, sem caminhos ou caracteres de controle.

```xml
<testsuites>
  <testsuite name="CI">
    <testcase name="Login" classname="Autenticação">
      <properties>
        <property name="lambdaquality.caseId" value="66666666-6666-4666-8666-666666666666"/>
        <property name="lambdaquality.humanId" value="QA-12"/>
      </properties>
    </testcase>
  </testsuite>
</testsuites>
```

Aceita raiz `testsuite` ou `testsuites`, inclusive suítes aninhadas até 64 níveis.
`failure`/`error` produzem FAILED; `skipped` produz SKIPPED; demais PASSED.
FAILED prevalece sobre SKIPPED quando ambos existem. Nome/classname até 1000
caracteres; detalhes de falha/skip até 10000, truncados. `system-out` e
`system-err` são ignorados. DTD e entidades personalizadas são rejeitadas;
entidades XML básicas e referências numéricas são decodificadas, sem acesso
à rede ou ao filesystem.

IDs explícitos são extraídos do `name` do testcase ou de propriedades do
próprio testcase, por atributo `value` ou texto. UUID é da definição original;
humanId é comparado com o snapshot. Nome/título igual nunca associa sozinho.
Só uma correspondência inequívoca recebe `proposedRunCaseId`.

### Respostas de sucesso

HTTP **200**. Campos do recibo:

| Campo | Tipo | Significado |
| --- | --- | --- |
| previewId/runId | UUID | Prévia criada/execução |
| version | inteiro | Versão capturada da execução |
| fileName/fileHash/tool | texto | Nome, SHA-256 hex de 64 caracteres, JUNIT |
| createdAt/expiresAt | timestamp | Prazo de aplicação: 30 minutos |
| status | PREVIEW/EXPIRED/APPLIED | Estado atual do recibo |
| items | lista | itemId numérico (1–500), name, className nullable, result, caseIds/humanIds, details nullable, proposedRunCaseId nullable, blockers |
| appliedAt/appliedVersion/requestKey/mappings | nullable | null até aplicação; depois instante, versão gravada, chave e seleção aplicada |
| importedCount | inteiro | 0 até aplicar; depois tamanho de mappings |

Exemplo de envelope completo de prévia:

```json
{
  "data": {
    "previewId": "44444444-4444-4444-8444-444444444444",
    "runId": "33333333-3333-4333-8333-333333333333",
    "version": 2,
    "fileName": "junit.xml",
    "fileHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "tool": "JUNIT",
    "createdAt": "2026-10-08T12:00:00.000-03:00",
    "expiresAt": "2026-10-08T12:30:00.000-03:00",
    "status": "PREVIEW",
    "items": [{
      "itemId": 1,
      "name": "Login",
      "className": "Autenticação",
      "result": "PASSED",
      "caseIds": ["66666666-6666-4666-8666-666666666666"],
      "humanIds": ["QA-12"],
      "details": null,
      "proposedRunCaseId": "55555555-5555-4555-8555-555555555555",
      "blockers": []
    }],
    "appliedAt": null,
    "appliedVersion": null,
    "requestKey": null,
    "mappings": null,
    "importedCount": 0
  },
  "message": "Prévia JUnit gerada com sucesso.",
  "meta": {"requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "timestamp": "2026-10-08T12:00:00.000-03:00"}
}
```

Avisos `INVALID_CASE_ID`, `INVALID_HUMAN_ID`, `IDENTIFIER_MISSING`,
`CASE_NOT_IN_RUN`, `AMBIGUOUS_IDENTIFIER` e `DUPLICATE_RESULT` deixam a proposta
nula. São bloqueios da **associação automática**: o usuário pode revisar,
selecionar uma ocorrência e mapear explicitamente um destino válido. Uma
aplicação nunca aceita o mesmo item ou destino duas vezes.

### Erros e tratamento no front-end

| HTTP | code | Quando | Tratamento |
| --- | --- | --- | --- |
| 400 | TEST_RESULT_IMPORT_INVALID | Nome/extensão/XML/UTF-8/limites de resultados inválidos | Corrigir arquivo, preservar seleção local |
| 400 | VALIDATION_ERROR | UUID/query/multipart inválido | Corrigir requisição |
| 401 | Códigos de autenticação existentes | Sessão inválida | Interceptor existente |
| 403 | AUTH_FORBIDDEN | Falta read ou execute | Recarregar capacidades |
| 404 | RESOURCE_NOT_FOUND | Escopo/recurso inacessível | Reconsultar acesso |
| 409 | PROJECT_ARCHIVED / TEST_RUN_NOT_IN_PROGRESS / TEST_RESULT_IMPORT_PLAN_REQUIRED | Pré-condição inválida | Reconsultar execução/projeto |
| 413 | PAYLOAD_TOO_LARGE | Mais de 2 MiB | Escolher relatório menor |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | Falha de serviço | Mostrar detail/requestId |

### Fluxo de integração

Selecionar relatório, obter prévia do servidor, mostrar resultados/propostas e
permitir revisão de cada associação. Apenas o autor da prévia a consulta/aplica.
Prévia não é idempotente: repetir o upload cria outro previewId, sem resultados
duplicados na execução. Não precisa enviar o arquivo à biblioteca de anexos/OCI.

### Alterações e compatibilidade

Nova rota. Guarda nome/hash e resultados analisados no banco, sem XML bruto ou
arquivo local. O front pode manter sua prévia local, mas usa os itemIds e a versão
da prévia do servidor para aplicar. Migration indicada no início deste guia.

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/result-imports/{previewId}/apply

### Objetivo e acesso

**operationId:** `applyTestRunResultImport`. Exige `testrun.read/execute` e
autoria da prévia. Nova aplicação exige projeto ativo, run `IN_PROGRESS` de
plano e prévia não aplicada/não expirada. Revalida todos os destinos antes de
gravar; resultados, recibo, auditoria e incremento de versão são atômicos.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| rota | workspaceId/projectId/runId/previewId | UUID v4 | sim | Mesma execução e autor |
| JSON | version | inteiro >=1 | sim | Igual à versão atual e à capturada na prévia |
| JSON | requestKey | UUID v4 | sim | Nova chave por aplicação, reutilizar os mesmos dados após resposta incerta |
| JSON | overwrite | boolean | não | false; true autoriza substituir qualquer resultado diferente de NOT_TESTED |
| JSON | mappings | lista de objetos | sim | 1–500; itemId inteiro 1–500 e runCaseId UUID v4; ambos distintos |

Content-Type `application/json`, sem query/campos adicionais. Esta rota aceita
até **128 KiB** de JSON; as demais mantêm 32 KiB.

```json
{
  "version": 2,
  "requestKey": "77777777-7777-4777-8777-777777777777",
  "overwrite": false,
  "mappings": [{"itemId": 1, "runCaseId": "55555555-5555-4555-8555-555555555555"}]
}
```

### Respostas de sucesso

HTTP **200**, message `Resultados JUnit importados com sucesso.`. `data` tem
`run` completo conforme [Run](execution-contracts.md), `import` completo conforme
a prévia acima e `alreadyApplied` boolean. Primeira aplicação: run.version +1,
import.status APPLIED, appliedVersion igual à versão gravada, importedCount igual
à seleção e mappings confirmados; alreadyApplied=false. O envelope meta permanece
igual ao exemplo de prévia. Em replay alreadyApplied=true, sem escrita; run é o
estado **atual**, enquanto appliedVersion continua sendo a versão histórica.

Resultados importados recebem `resultOrigin: JUNIT` e `externalResult` com
origin/importId/itemId/fileName/fileHash/name/className/details. `executedBy` e
`executedAt` registram o autor/instante da importação. Comentário do caso e
histórico de comentários existentes permanecem iguais; detalhes JUnit ficam
em externalResult. Passos, definições, tags e valores do snapshot ficam iguais.
O servidor não encerra a execução automaticamente.

**PASSED externo aceita passos pendentes**, inclusive na conclusão posterior
da execução. A interface deve identificar o resultado externo e apresentar
passos pendentes como pendentes. Não preencher passos fictícios nem inferir
automação da definição original a partir desse resultado.

### Erros e tratamento no front-end

Além dos erros compartilhados de autenticação/acesso, validação e serviço:

| HTTP | code | Quando | Tratamento |
| --- | --- | --- | --- |
| 400 | TEST_RESULT_IMPORT_MAPPING_INVALID | Item inexistente ou itens/destinos repetidos | Corrigir seleção; nenhum resultado foi gravado |
| 404 | RESOURCE_NOT_FOUND | Prévia de outro autor/escopo ou destino fora da execução | Reconsultar escopo, sem gravação parcial |
| 409 | TEST_RUN_VERSION_CONFLICT | Run mudou desde prévia ou versão do body incorreta | Reconsultar run e gerar nova prévia |
| 409 | TEST_RESULT_IMPORT_EXPIRED | Mais de 30 minutos | Gerar nova prévia |
| 409 | TEST_RESULT_IMPORT_OVERWRITE_REQUIRED | Há resultado preenchido e overwrite=false | Pedir confirmação explícita antes de enviar overwrite=true |
| 409 | TEST_RESULT_IMPORT_KEY_CONFLICT | requestKey já usado com outra prévia/dados | Consultar recibo; não trocar chave para contornar duplicação |
| 409 | TEST_RESULT_IMPORT_ALREADY_APPLIED | Prévia aplicada com outra chave | Consultar recibo |
| 409 | PROJECT_ARCHIVED / TEST_RUN_NOT_IN_PROGRESS / TEST_RESULT_IMPORT_PLAN_REQUIRED | Nova escrita não permitida | Reconsultar estado |
| 413 | PAYLOAD_TOO_LARGE | JSON acima de 128 KiB | Reduzir corpo |

Exemplo de Problem Details:

```json
{
  "type": "urn:lambdaquality:problem:test-run-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "A execução mudou desde a prévia. Gere uma nova prévia antes de aplicar.",
  "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-runs/33333333-3333-4333-8333-333333333333/result-imports/44444444-4444-4444-8444-444444444444/apply",
  "code": "TEST_RUN_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-08T12:00:00.000-03:00"
}
```

### Fluxo de integração

Enviar uma aplicação com os itens selecionados e chave nova; impedir submissões
concorrentes na UI. Após sucesso, atualizar run/versão/fila e reconsultar casos.
Em timeout/5xx, consultar o recibo pelo GET abaixo antes de continuar. Se APPLIED
com a mesma requestKey/mappings, considerar confirmado e consultar o run atual.
Se PREVIEW, pode repetir **o mesmo body e chave**; ordem dos mappings não muda
a identidade. Nunca repetir automaticamente com nova chave. Mesmo body/chave
confirmados podem ser consultados por replay após encerramento/arquivamento,
desde que os grants atuais ainda permitam read/execute; isso não grava nada.

### Alterações e compatibilidade

Nova rota e modo externo separado. PUT manual de resultado continua exigindo
passos PASSED/SKIPPED para aprovar. PUT manual do caso limpa a origem externa;
editar qualquer passo volta o caso a NOT_TESTED/MANUAL, externalResult=null.
Recibos anteriores continuam consultáveis. Runs encerradas não recebem novas
importações. Uma prévia aplica uma única seleção; itens não selecionados exigem
outra prévia com a nova versão. Migration indicada no início deste guia.

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-runs/{runId}/result-imports/{previewId}

### Objetivo e acesso

**operationId:** `getTestRunResultImport`. Bearer e `testrun.read`, somente autor,
no mesmo Workspace/projeto/run. Consulta permitida após conclusão, aborto,
expiração ou arquivamento do projeto; não muda resultados/versão.

### Requisição

Quatro IDs UUID v4 na rota, sem body/query. Requisição de exemplo:

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/test-runs/33333333-3333-4333-8333-333333333333/result-imports/44444444-4444-4444-8444-444444444444
Authorization: Bearer <access-token>
```

### Respostas de sucesso

HTTP **200**, envelope com o mesmo `data` de ResultImportResponse descrito no
preview, incluindo status/requestKey/mappings/appliedVersion. Message
`Importação JUnit consultada com sucesso.`. Expiração muda a classificação
PREVIEW→EXPIRED na leitura, sem gravação; APPLIED permanece APPLIED.

### Erros e tratamento no front-end

400 VALIDATION_ERROR (UUID/query), 401 autenticação, 403 AUTH_FORBIDDEN,
404 RESOURCE_NOT_FOUND (inclui outro autor), 500/503 serviço. Usar detail e
requestId, sem limpar sessão em falha de importação. GET pode ser repetido;
se não houver acesso, não repetir apply. O recibo não expõe XML bruto.

### Fluxo de integração

Após resposta incerta do apply, consultar recibo; comparar chave e mappings,
então atualizar a execução ou decidir reenviar os mesmos dados. Ao trocar
escopo/cancelar navegação, cancelar consultas e limpar previews da UI.

### Alterações e compatibilidade

Nova rota de reconciliação; sem polling automático obrigatório. Prévia/recibo
é persistente no banco e sobrevive à reinicialização da API. Não há exclusão
automática de recibos; expiração bloqueia aplicação, não elimina o histórico.

## POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/test-plans/{planId}/cases/bulk

### Objetivo e acesso

**operationId:** `addTestPlanCasesBulk`. Bearer, `testrun.manage` e
`testcase.read`, projeto ativo e plano DRAFT. Inclui a seleção inteira na
mesma transação, depois da seleção existente, na ordem recebida.

### Requisição

| Local | Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- | --- |
| rota | workspaceId/projectId/planId | UUID v4 | sim | Plano do escopo |
| JSON | version | inteiro >=1 | sim | Versão atual do plano |
| JSON | caseIds | UUID v4[] | sim | 1–500, sem repetidos; máximo 500 somando os existentes |

Sem query/campos extras, JSON até 32 KiB. IDs de casos da biblioteca do projeto;
DRAFT ou ACTIVE são permitidos. DEPRECATED/ARCHIVED não podem ser selecionados.

```json
{"version": 1, "caseIds": ["66666666-6666-4666-8666-666666666666"]}
```

### Respostas de sucesso

HTTP **200**, envelope `data` TestPlan completo com `cases` ordenados conforme
[contrato](execution-contracts.md), version anterior +1 e updatedAt atual;
message `Casos adicionados em lote com sucesso.`. Uma auditoria e um incremento
para todo o lote. O formato de TestPlan já existente não muda.

### Erros e tratamento no front-end

| HTTP | code | Quando | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR / TEST_SELECTION_INVALID | IDs/lista/body inválidos ou total acima de 500 | Corrigir seleção |
| 409 | TEST_PLAN_CASE_EXISTS | Um ID já está no plano | Reconsultar plano; nenhuma inclusão ocorre |
| 409 | TEST_PLAN_VERSION_CONFLICT | Versão desatualizada | Reconsultar antes de reenviar |
| 409 | TEST_PLAN_NOT_DRAFT / PROJECT_ARCHIVED | Recurso não editável | Reconsultar estado |
| 409 | TEST_CASE_NOT_EXECUTABLE | Caso indisponível | Rever seleção |
| 401/403/404 | Erros compartilhados | Sessão/grants/escopo | Fluxo existente |
| 413/500/503 | PAYLOAD_TOO_LARGE / INTERNAL_ERROR / SERVICE_UNAVAILABLE | Corpo/serviço | Mostrar detail/requestId |

### Fluxo de integração

Substituir a fila de POST individuais por um POST bulk quando a seleção tiver
vários novos casos. Usar a versão retornada em todas as escritas seguintes.
Sem retry automático: em resposta incerta, consultar o plano e conferir os IDs
antes de reenviar. Não há gravação parcial. Não usar em planos ACTIVE.

### Alterações e compatibilidade

Nova rota; POST individual e createPlan.caseIds continuam funcionando. Bulk não
tem requestKey e não é idempotente: duplicados retornam 409. Sem migration própria.

## GET /api/v1/test-runs

### Objetivo e acesso

**operationId:** `listTestRunInventory`. Bearer; lista execuções de todos os
Workspaces ativos e projetos visíveis com `testrun.read`, inclusive projetos
arquivados. Visibilidade e grant efetivo são aplicados **antes** de filtros,
contagem e paginação. Nomes de Workspace/projeto acompanham cada execução.

### Requisição

| Query | Tipo | Padrão / regras |
| --- | --- | --- |
| page/size | inteiro | 1/20; page 1–100000, size 1–100 |
| workspaceId/projectId | UUID v4 | Opcionais; projeto deve pertencer ao Workspace quando ambos informados |
| status | enum | Omitido/ALL inclui CREATED, IN_PROGRESS, COMPLETED, ABORTED |
| q | texto | Busca name, até 100 caracteres |
| sort | texto | name, createdAt, startedAt ou finishedAt + asc/desc; padrão createdAt,desc; desempate id ASC |

```http
GET /api/v1/test-runs?workspaceId=11111111-1111-4111-8111-111111111111&status=IN_PROGRESS&page=1&size=20&sort=createdAt,desc
Authorization: Bearer <access-token>
```

### Respostas de sucesso

HTTP **200**, data é RunResponse[] conforme [contrato](execution-contracts.md),
com `workspaceName`, `projectName`, `projectKey`, `projectStatus` (ACTIVE/ARCHIVED).
Cada `summary` agrega os resultados atuais apenas dos casos da execução;
não carrega passos/definições individuais. Message `Execuções consultadas com
sucesso.`. meta.pagination tem page/size/totalItems/totalPages/hasNext/hasPrevious.
Inventário sem execuções autorizadas:

```json
{
  "data": [],
  "message": "Execuções consultadas com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-08T12:00:00.000-03:00",
    "pagination": {"page": 1, "size": 20, "totalItems": 0, "totalPages": 0, "hasNext": false, "hasPrevious": false}
  }
}
```

### Erros e tratamento no front-end

400 VALIDATION_ERROR para UUID/enums/paginação/sort/query extra; 401 para sessão;
404 RESOURCE_NOT_FOUND para Workspace inacessível ou projectId sem visibilidade
e grant, mesmo sem workspaceId. Sem projectId, projetos sem grant são omitidos;
uma lista vazia não significa falta de sessão. 500/503 seguem envelope existente.

### Fluxo de integração

Trocar a enumeração de páginas por projeto pela consulta paginada consolidada.
Abrir o detalhe usando workspaceId/projectId/id da linha e a rota scoped existente.
Filtros/sort são enviados ao servidor; cancelar chamadas ao mudar filtro/escopo.
GET não altera execução e pode ser repetido.

### Alterações e compatibilidade

Nova rota. Lista scoped permanece disponível. Nenhum grant novo ou alteração
da origem de runs; `source` permanece MANUAL na criação, mesmo com importações
JUNIT em casos. Sem migration própria. Sem cache local obrigatório.

## GET /api/v1/dashboard/projects

### Objetivo e acesso

**operationId:** `listDashboardProjects`. Bearer, `project.read` efetivo e
visibilidade local antes de filtros/contagem/paginação; todos os Workspaces
ativos. Contagens de catálogo requerem separadamente `testcase.read`.

### Requisição

| Query | Tipo | Padrão / regras |
| --- | --- | --- |
| page/size | inteiro | 1/20; page 1–100000, size 1–100 |
| workspaceId | UUID v4 | Opcional |
| status | ACTIVE/ARCHIVED/ALL | ACTIVE |
| q | texto | Busca name/key, até 100 caracteres |
| sort | texto | name/key/createdAt,asc ou desc; padrão name,asc, desempate id ASC |

```http
GET /api/v1/dashboard/projects?page=1&size=20&status=ALL&sort=name,asc
Authorization: Bearer <access-token>
```

### Respostas de sucesso

HTTP **200**, data com id/workspaceId/workspaceName/name/key/status/createdAt/
updatedAt/permissions e indicadores nullable. Base: casos ACTIVE atuais, sem
arquivamento, independente de período da overview. automatedTestCases conta
AUTOMATED nessa base; automationCoverage = automated/active ×100, até duas casas.
Sem testcase.read, todos os três indicadores são null. Base vazia autorizada:
contagens zero, coverage null. Casos DRAFT/DEPRECATED/ARCHIVED não entram.
Projetos arquivados entram quando o filtro pede; suas contagens continuam sendo
as do catálogo ACTIVE preservado. Não altera metrics ou limite da overview.

```json
{
  "data": [{
    "id": "22222222-2222-4222-8222-222222222222",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "workspaceName": "Equipe de testes",
    "name": "Portal",
    "key": "PORTAL",
    "status": "ACTIVE",
    "createdAt": "2026-10-08T12:00:00.000-03:00",
    "updatedAt": "2026-10-08T12:00:00.000-03:00",
    "permissions": ["project.read", "testcase.read"],
    "activeTestCases": 2,
    "automatedTestCases": 1,
    "automationCoverage": 50
  }],
  "message": "Projetos consultados com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-08T12:00:00.000-03:00",
    "pagination": {"page": 1, "size": 20, "totalItems": 1, "totalPages": 1, "hasNext": false, "hasPrevious": false}
  }
}
```

### Erros e tratamento no front-end

400 VALIDATION_ERROR (UUID/status/page/size/sort/query extra), 401 autenticação,
404 RESOURCE_NOT_FOUND para Workspace inacessível, 500/503 serviço. Projetos sem
project.read são omitidos; indicadores sem grant ficam null, nunca zero fictício.
Resposta vazia segue o exemplo de inventário, com message de projetos.

### Fluxo de integração

Usar esta lista para “Meus projetos”; remover enumeração e consultas de contagem
por projeto. Paginar ou carregar mais conforme rolagem. Card abre projeto com
workspaceId/id. Mostrar `—` para null; aplicar permissions atuais da linha sem
inferir privilégios por role. Cancelar consultas ao trocar filtros/encerrar sessão.

### Alterações e compatibilidade

Nova rota, sem migration própria. Overview continua disponível com seu limite;
esta rota oferece o catálogo paginado completo. API mantém compatibilidade com
os fluxos atuais que ainda enumeram projetos e execuções.

## Alterações em endpoints existentes

GET de casos de execução (lista/detalhe) acrescenta `resultOrigin` MANUAL/JUNIT e
`externalResult` nullable conforme OpenAPI. Não remover `result`, `steps` ou
snapshots atuais. PUT manual de resultado/passo não aceita os campos novos no
body. POST de conclusão de run respeita aprovação externa JUNIT auditada;
casos MANUAL continuam sujeitos à regra de passos. Aplique a migration antes
da API e adapte o front para mostrar a origem externa e consultar recibos.

## Verificação

Testes unitários/HTTP e integração real nos dois dialetos cobrem JUnit seguro,
limites 500/2 MiB, seleção/mapeamento, atomicidade, replay concorrente, resposta
incerta, expiração/versão, overwrite, preservação de snapshots/passos/comentários,
conclusão externa e regra manual, isolamento/grants, arquivamento, paginação e
indicadores independentes. Ver o registro de resultados em
[decisões da entrega](../codex/EXECUTION_IMPORTS_20261008.md).
