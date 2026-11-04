# Contratos e integração de Planos e Execuções

Fase 04 implementada, API v1, 02/10/2026. [24 endpoints](execution.md),
[OpenAPI](openapi.json) e [decisões](../codex/EXECUTION_IMPLEMENTATION_DECISIONS.md).
Base /api/v1; UUID v4, timestamps com offset -03:00, envelopes e Problem Details seguem
[Workspace](workspace-contracts.md). JSON de entrada limitado a 32 KiB, exceto apply JUnit (128 KiB);
campos extras/query de mutação são rejeitados. Snapshots de saída podem ser maiores.

## Acesso e compatibilidade

| Role local | Capabilities possíveis (interseção com grants do Workspace) |
| ---------- | ----------------------------------------------------------- |
| VIEWER     | testrun.read                                                |
| EDITOR     | testrun.read, testrun.execute                               |
| MANAGER    | As de EDITOR + testrun.manage                               |

read inclui planos/casos/resultados/comentários; execute inicia/conclui Run,
registra resultados e comentários; manage administra planos, cria Run e aborta.
Adicionar casos, ativar plano e criar Run exigem também testcase.read; criar
plano com seleção não vazia também. Projeto arquivado bloqueia toda mutação.
Owner/Administrator têm as três novas permissions. Member recebe apenas read
com vínculo local; roles customizadas preservam grants. manage_all dispensa
vínculo local mas continua exigindo permission da operação. Backend revalida
membership/grants atuais; não confiar em claims ou UUID.

Na Fase 04 o catálogo passou de 24 para 27 permissions. WorkspaceResponse.permissions,
Role.permissionCodes e ProjectResponse.permissions podem conter testrun.*.
Atribuir EDITOR/MANAGER exige capabilities testrun da role, além das anteriores;
atualizar grants administrativos customizados conforme [Projetos](project-contracts.md).
Identidade e convites mantêm payload. Migration aditiva 202610020004_execution.

## Planos e contexto

DRAFT permite alterar metadados e seleção ordenada; caseIds ausente/[] cria
plano vazio. Seleção aceita casos DRAFT/ACTIVE disponíveis do mesmo projeto,
até 500 distintos. Reorder usa IDs de TestCase e precisa conter toda seleção;
position base 1, densa. DELETE de seleção envia body com version.
Activate exige todos ACTIVE e seleção não vazia. ACTIVE congela o plano,
mas cada Run copia a definição atual dos casos ao ser criado.
Complete exige ACTIVE e nenhum Run CREATED/IN_PROGRESS; permite plano sem Runs.
Archive aceita DRAFT/ACTIVE/COMPLETED sem Runs abertos. Sem restore/hard delete.
COMPLETED/ARCHIVED não criam Runs.

milestoneId/environmentId opcionais/nulos, do mesmo projeto e não excluídos;
marco CANCELLED e ambiente inativo não são selecionáveis. Run de plano herda
ambos sem overrides e valida disponibilidade atual. Runs existentes preservam
nome/descrição em snapshots após rename/exclusão lógica do contexto.

## Runs, resultados e histórico

Criação avulsa exige 1–500 TestCase IDs distintos, ACTIVE e com campos obrigatórios
atuais preenchidos. Até 10000 passos somados. source=MANUAL e externalRunRef=null;
API não aceita fonte externa, resultado inicial ou snapshot do cliente.
Criação e cópias ocorrem na mesma transação; falha não deixa Run parcial.

CREATED → IN_PROGRESS → COMPLETED; CREATED/IN_PROGRESS → ABORTED.
Start define startedAt, fechamento define finishedAt. Terminal é imutável e
não tem reopen. Abort preserva resultados parciais e NOT_TESTED.
Todos começam NOT_TESTED. Resultado de caso é explícito e independente do passo:
PASSED manual exige passos PASSED/SKIPPED; caso sem passos pode passar diretamente.
FAILED/BLOCKED/SKIPPED podem interromper caso antes de concluir os passos.
Alterar resultado de passo invalida caso para NOT_TESTED; reconfirmar depois.
Complete exige todos os casos com resultado final; não modifica resultados.
NOT_TESTED limpa executedBy/executedAt; demais registram ator/hora do servidor.
comment/actualResult opcionais mantêm quando ausentes, null limpa, até 10000 caracteres.

Snapshot inclui sequência/humanId/título/prioridade/severidade, versão e definição
completa, passos com dados/resultado esperado, tags ID/nome e valores personalizados
com key/name/type/options/required/archivedAt. Campos arquivados que possuem valor
permanecem no snapshot, preservando significado. SINGLE_SELECT guarda UUID da opção
e labels no snapshot; BOOLEAN false e NUMBER 0 são valores válidos.
Anexos não são copiados/publicados: biblioteca privada mantém attachment.read.
Alterações/remoção de passo/archive da definição não mudam snapshots existentes.
sourceStepId é informativo; runCaseId/runStepId identificam cópias distintas.

## Comentários e concorrência

PUT de resultado modifica comment do resultado. POST /comments adiciona um
registro separado imutável com autor/hora; alvo opcional é Run, caso ou passo.
runStepId exige runCaseId correspondente do mesmo Run. text trim 1–10000;
resultados/comentários exigem IN_PROGRESS. Não há editar/remover comentário.
POST retorna RunResponse/version; GET /comments consulta registros.

Todas as escritas em Plan/Run existente exigem version atual e incrementam
respectivo agregado. Resultados de passo/caso e comentários usam version do Run,
não do snapshot de TestCase. Criação de Run de plano valida version do plano,
mas não a incrementa; o novo Run inicia version=1. Conflitos 409 exigem conciliar.
Repetir transição para estado atual é no-op apenas com version atual; PUTs de
resultado continuam incrementando version e passo invalida caso. Criação e
comentários não são idempotentes. Timeout: consultar servidor antes de repetir.

## Fluxo manual do front-end

1. Selecionar Workspace/Project e consultar biblioteca de casos ACTIVE.
2. Criar plano DRAFT, editar seleção/contexto e ativar; ou criar Run avulso.
3. Criar Run, obter id/version/summary; GET /cases fornece IDs das cópias/passos.
4. Iniciar Run; registrar passos serializando escritas com version retornada.
5. Confirmar resultado explícito do caso após passos; atualizar summary e cópias.
6. Adicionar comentários quando necessário; concluir todos os casos e Run ou abortar.

Cache inclui workspaceId/projectId/planId/runId; invalidar casos, summary e
comentários afetados. Listas retornam data[] + meta.pagination; vazias são 200.
page padrão 1 (máximo 100000), size=20 (máximo 100). sort permitido por endpoint,
com desempate id. Plan lista exclui ARCHIVED por padrão; Run lista inclui todos.
q trim 1–100 busca name/titleSnapshot/text conforme rota; seleção do plano não aceita q.
403 atualiza acesso; 404 não revela outro tenant. Desde 08/10/2026,
operações autenticadas de planos/execuções não têm quota geral de requisições.
Preservar requestId e errors[].field; mensagens não são critérios de controle.
Leituras podem repetir com backoff; mutações exigem confirmar estado após rede/timeout.

## Modelos de resposta

Todos os campos abaixo são retornados (não omitidos); null é explícito quando
permitido. Arrays vazios são []; identificadores são UUID, datas UTC.
PlanResponse inclui seleção; RunResponse inclui summary sem cópias; RunCaseResponse
inclui steps. Enum de results: NOT_TESTED/PASSED/FAILED/BLOCKED/SKIPPED.
Campos de definição/severidade/prioridade seguem [Casos de Teste](test-case-contracts.md).

## PlanResponse

| Campo         | Tipo/formato       | Regras                                    |
| ------------- | ------------------ | ----------------------------------------- |
| id            | uuid               | Conforme contrato compartilhado.          |
| workspaceId   | uuid               | Conforme contrato compartilhado.          |
| projectId     | uuid               | Conforme contrato compartilhado.          |
| milestoneId   | uuid               | Aceita null.                              |
| environmentId | uuid               | Aceita null.                              |
| name          | string             | Conforme contrato compartilhado.          |
| description   | string             | Aceita null.                              |
| status        | string             | Enum: DRAFT, ACTIVE, COMPLETED, ARCHIVED. |
| version       | number             | Conforme contrato compartilhado.          |
| createdBy     | uuid               | Conforme contrato compartilhado.          |
| createdAt     | date-time          | Conforme contrato compartilhado.          |
| updatedAt     | date-time          | Conforme contrato compartilhado.          |
| activatedAt   | date-time          | Aceita null.                              |
| completedAt   | date-time          | Aceita null.                              |
| archivedAt    | date-time          | Aceita null.                              |
| cases         | PlanCaseResponse[] | Conforme contrato compartilhado.          |

## PlanCaseResponse

| Campo       | Tipo/formato | Regras                           |
| ----------- | ------------ | -------------------------------- |
| id          | uuid         | Conforme contrato compartilhado. |
| workspaceId | uuid         | Conforme contrato compartilhado. |
| projectId   | uuid         | Conforme contrato compartilhado. |
| testPlanId  | uuid         | Conforme contrato compartilhado. |
| testCaseId  | uuid         | Conforme contrato compartilhado. |
| position    | number       | Conforme contrato compartilhado. |

## RunResponse

| Campo               | Tipo/formato       | Regras                                          |
| ------------------- | ------------------ | ----------------------------------------------- |
| id                  | uuid               | Conforme contrato compartilhado.                |
| workspaceId         | uuid               | Conforme contrato compartilhado.                |
| projectId           | uuid               | Conforme contrato compartilhado.                |
| testPlanId          | uuid               | Aceita null.                                    |
| milestoneId         | uuid               | Aceita null.                                    |
| environmentId       | uuid               | Aceita null.                                    |
| planNameSnapshot    | string             | Aceita null.                                    |
| milestoneSnapshot   | object             | Aceita null.                                    |
| environmentSnapshot | object             | Aceita null.                                    |
| name                | string             | Conforme contrato compartilhado.                |
| source              | string             | Enum: MANUAL.                                   |
| externalRunRef      | string             | Aceita null.                                    |
| status              | string             | Enum: CREATED, IN_PROGRESS, COMPLETED, ABORTED. |
| version             | number             | Conforme contrato compartilhado.                |
| createdBy           | uuid               | Conforme contrato compartilhado.                |
| createdAt           | date-time          | Conforme contrato compartilhado.                |
| updatedAt           | date-time          | Conforme contrato compartilhado.                |
| startedAt           | date-time          | Aceita null.                                    |
| finishedAt          | date-time          | Aceita null.                                    |
| summary             | RunSummaryResponse | Conforme contrato compartilhado.                |

## ContextSnapshotResponse

| Campo       | Tipo/formato | Regras                           |
| ----------- | ------------ | -------------------------------- |
| name        | string       | Conforme contrato compartilhado. |
| description | string       | Aceita null.                     |

## RunSummaryResponse

| Campo     | Tipo/formato | Regras                           |
| --------- | ------------ | -------------------------------- |
| total     | number       | Conforme contrato compartilhado. |
| notTested | number       | Conforme contrato compartilhado. |
| passed    | number       | Conforme contrato compartilhado. |
| failed    | number       | Conforme contrato compartilhado. |
| blocked   | number       | Conforme contrato compartilhado. |
| skipped   | number       | Conforme contrato compartilhado. |

## RunCaseResponse

| Campo                | Tipo/formato               | Regras                                              |
| -------------------- | -------------------------- | --------------------------------------------------- |
| id                   | uuid                       | Conforme contrato compartilhado.                    |
| workspaceId          | uuid                       | Conforme contrato compartilhado.                    |
| projectId            | uuid                       | Conforme contrato compartilhado.                    |
| testRunId            | uuid                       | Conforme contrato compartilhado.                    |
| testCaseId           | uuid                       | Conforme contrato compartilhado.                    |
| position             | number                     | Conforme contrato compartilhado.                    |
| caseSequenceSnapshot | number                     | Conforme contrato compartilhado.                    |
| humanIdSnapshot      | string                     | Conforme contrato compartilhado.                    |
| titleSnapshot        | string                     | Conforme contrato compartilhado.                    |
| severitySnapshot     | string                     | Conforme contrato compartilhado.                    |
| prioritySnapshot     | string                     | Conforme contrato compartilhado.                    |
| definitionSnapshot   | DefinitionSnapshotResponse | Conforme contrato compartilhado.                    |
| customFieldsSnapshot | FieldSnapshotResponse[]    | Conforme contrato compartilhado.                    |
| tagsSnapshot         | TagSnapshotResponse[]      | Conforme contrato compartilhado.                    |
| result               | string                     | Enum: NOT_TESTED, PASSED, FAILED, BLOCKED, SKIPPED. |
| executedBy           | uuid                       | Aceita null.                                        |
| executedAt           | date-time                  | Aceita null.                                        |
| comment              | string                     | Aceita null.                                        |
| createdAt            | date-time                  | Conforme contrato compartilhado.                    |
| updatedAt            | date-time                  | Conforme contrato compartilhado.                    |
| steps                | RunStepResponse[]          | Conforme contrato compartilhado.                    |

## DefinitionSnapshotResponse

| Campo            | Tipo/formato | Regras                           |
| ---------------- | ------------ | -------------------------------- |
| description      | string       | Aceita null.                     |
| preconditions    | string       | Aceita null.                     |
| postconditions   | string       | Aceita null.                     |
| type             | string       | Conforme contrato compartilhado. |
| layer            | string       | Conforme contrato compartilhado. |
| behavior         | string       | Aceita null.                     |
| automationStatus | string       | Conforme contrato compartilhado. |
| suiteId          | uuid         | Aceita null.                     |
| status           | string       | Conforme contrato compartilhado. |
| version          | number       | Conforme contrato compartilhado. |

## FieldSnapshotResponse

| Campo      | Tipo/formato                  | Regras                           |
| ---------- | ----------------------------- | -------------------------------- |
| fieldId    | uuid                          | Conforme contrato compartilhado. |
| key        | string                        | Conforme contrato compartilhado. |
| name       | string                        | Conforme contrato compartilhado. |
| type       | string                        | Conforme contrato compartilhado. |
| required   | boolean                       | Conforme contrato compartilhado. |
| options    | FieldOptionSnapshotResponse[] | Conforme contrato compartilhado. |
| archivedAt | date-time                     | Aceita null.                     |
| value      | string / number / boolean     | Conforme contrato compartilhado. |

## FieldOptionSnapshotResponse

| Campo | Tipo/formato | Regras                           |
| ----- | ------------ | -------------------------------- |
| id    | uuid         | Conforme contrato compartilhado. |
| label | string       | Conforme contrato compartilhado. |

## TagSnapshotResponse

| Campo | Tipo/formato | Regras                           |
| ----- | ------------ | -------------------------------- |
| id    | uuid         | Conforme contrato compartilhado. |
| name  | string       | Conforme contrato compartilhado. |

## RunStepResponse

| Campo                  | Tipo/formato | Regras                                              |
| ---------------------- | ------------ | --------------------------------------------------- |
| id                     | uuid         | Conforme contrato compartilhado.                    |
| workspaceId            | uuid         | Conforme contrato compartilhado.                    |
| projectId              | uuid         | Conforme contrato compartilhado.                    |
| testRunId              | uuid         | Conforme contrato compartilhado.                    |
| testRunCaseId          | uuid         | Conforme contrato compartilhado.                    |
| sourceStepId           | uuid         | Conforme contrato compartilhado.                    |
| position               | number       | Conforme contrato compartilhado.                    |
| actionSnapshot         | string       | Conforme contrato compartilhado.                    |
| testDataSnapshot       | string       | Aceita null.                                        |
| expectedResultSnapshot | string       | Aceita null.                                        |
| actualResult           | string       | Aceita null.                                        |
| result                 | string       | Enum: NOT_TESTED, PASSED, FAILED, BLOCKED, SKIPPED. |
| comment                | string       | Aceita null.                                        |
| executedBy             | uuid         | Aceita null.                                        |
| executedAt             | date-time    | Aceita null.                                        |

## ExecutionCommentResponse

| Campo       | Tipo/formato | Regras                           |
| ----------- | ------------ | -------------------------------- |
| id          | uuid         | Conforme contrato compartilhado. |
| workspaceId | uuid         | Conforme contrato compartilhado. |
| projectId   | uuid         | Conforme contrato compartilhado. |
| testRunId   | uuid         | Conforme contrato compartilhado. |
| runCaseId   | uuid         | Aceita null.                     |
| runStepId   | uuid         | Aceita null.                     |
| text        | string       | Conforme contrato compartilhado. |
| createdBy   | uuid         | Conforme contrato compartilhado. |
| createdAt   | date-time    | Conforme contrato compartilhado. |

## Evolução da Fase 05

[Defeitos](defect-contracts.md) permite criar origem de TestRunCase FAILED com
permission adicional defect.manage e testrun.read. IDs vêm das cópias, não de
TestCase. Não altera version/resultados/snapshots do Run; vínculo permanece se
resultado IN_PROGRESS mudar depois. Filtro de defeitos por testRunCaseId ajuda
exibir ocorrências. Catálogo atual com 35 permissions e matriz local inclui defect.*.

## Extensões de 08/10/2026

[JUnit auditável, seleção em lote e inventários](execution-imports-and-inventories.md)
adicionam seis rotas. GET de casos de execução (lista/detalhe) inclui
`resultOrigin: MANUAL | JUNIT` e `externalResult: null | {origin, importId,
itemId, fileName, fileHash, name, className, details}`. className/details são
nullable. Casos antigos e criados manualmente usam MANUAL/null.

Os corpos dos PUTs de resultado continuam iguais. Resultado importado JUNIT
pode aprovar caso e concluir execução com passos pendentes preservados; caso
MANUAL mantém validação de passos. PUT manual do caso limpa externalResult;
editar passo invalida o caso para NOT_TESTED/MANUAL/null. Recibos históricos
continuam consultáveis. Não inferir resultados dos passos nem automação do
catálogo a partir da origem JUNIT. Recarregar casos após importar.
