# Planos e Execuções — decisões da Fase 04

Solicitada em 02/10/2026. Escopo: TestPlan/TestPlanCase, TestRun/TestRunCase/
TestRunStep, execução manual, comentários e snapshots. Defeitos, integrações,
requisitos, Shared steps/parameters e governança continuam fora da fase.

## Acesso e concorrência

Três permissions novas: testrun.read (inclui planos), testrun.execute e
testrun.manage (administra planos, cria Runs e aborta). Member recebe read;
Administrator recebe as três; customizadas mantêm grants. VIEWER permite read,
EDITOR read/execute e MANAGER acrescenta manage, sempre intersectando grants
atuais. Start/complete/resultados/comentários exigem execute; abort exige manage.
Adicionar casos a plano e criar Run exigem também testcase.read no projeto.
Nenhuma permission é derivada exclusivamente de UUID/claim.

Plan/Run possuem version. Escritas exigem versão atual e incrementam o agregado;
conflitos retornam TEST_PLAN_VERSION_CONFLICT/TEST_RUN_VERSION_CONFLICT. Comandos
repetidos no mesmo estado são idempotentes apenas com version atual. Criação
não é idempotente. Mantém lock transacional de Workspace e auditoria atual.
Projeto arquivado bloqueia toda mutação, inclusive resultados. Sem hard delete.

## Planos

Criação DRAFT; metadados e seleção editáveis somente DRAFT. CaseIds opcionais
na criação; máximo 500, sem duplicatas, ordem base 1. Adição/removal/reorder
retornam agregado, com IDs de TestCase no reorder. Seleção aceita DRAFT/ACTIVE,
rejeita DEPRECATED/ARCHIVED. Activate exige seleção não vazia e casos ACTIVE.
Active congela seleção/metadados; não é snapshot: Runs copiam as definições
atuais ao serem criados. Complete exige ACTIVE e nenhum Run aberto deste
plano; não exige que exista Run. Archive permite DRAFT/ACTIVE/COMPLETED, também
sem Runs abertos. COMPLETED/ARCHIVED não criam novas execuções. Sem restore.

Milestone/environment opcionais, do mesmo Workspace/Project, não excluídos;
marco CANCELLED e ambiente inativo não podem ser escolhidos. Run do plano
herda ambos, sem overrides; valida disponibilidade atual na criação.
Os IDs permanecem como referências históricas; rótulos/contexto são snapshots
no Run, de modo que rename/exclusão lógica não altera a execução existente.

## Runs e snapshots

Criação avulsa exige 1–500 caseIds distintos; a partir de plano exige ACTIVE
não vazio. Casos precisam estar ACTIVE, no projeto e com campos obrigatórios
atuais preenchidos. Máximo 10000 passos somados por Run. source=MANUAL;
externalRunRef=null, sem aceitar fonte/referência externa no body nesta fase.
Run começa CREATED, resultados NOT_TESTED. Não permite trocar sua seleção.

Na mesma transação, copiar sequence/title/severity/priority, version e toda
a definição (descrição, pré/pós-condições, tipo, layer, behavior, automação,
suíte e status), passos e valores personalizados. Valores incluem definição,
key/name/type/options/required e estado de arquivamento de cada campo que tem
valor; assim rename/archive não altera o significado histórico. Tags são
snapshots de ID/nome. Anexos não são publicados nem copiados nesta fase;
a biblioteca privada continua exigindo attachment.read.

FKs compostas escopam planos/casos/RunCases/passos/comentários. sourceStepId
é informativo sem FK para TestStep: remover um passo atual é permitido sem
alterar seu snapshot. testCaseId tem FK RESTRICT composta e permanece sob
archive. Snapshot nunca é atualizado por operações de execução; campos de
resultado são separados. Nenhum endpoint aceita snapshots do cliente.

## Resultados, encerramento e comentários

CREATED → IN_PROGRESS → COMPLETED; CREATED/IN_PROGRESS → ABORTED. Start exige
execute; resultados/comentários exigem IN_PROGRESS. Terminal é imutável e não
oferece reopen. Abort preserva resultados parciais; não converte NOT_TESTED.

Resultados: NOT_TESTED/PASSED/FAILED/BLOCKED/SKIPPED. Resultado de caso é
explícito, sem inferência automática. PASSED exige que cada passo seja PASSED
ou SKIPPED; casos sem passos podem passar diretamente. FAILED/BLOCKED/SKIPPED
podem encerrar caso sem todos os passos, permitindo interrupção antecipada.
Alterar resultado de passo invalida resultado agregado do caso para NOT_TESTED,
exigindo confirmação explícita depois. NOT_TESTED limpa executedBy/executedAt.
Complete exige todos os casos com resultado terminal; não altera resultados.

PUT de resultado aceita comentário opcional/nulo (substitui só se informado),
passo aceita actualResult opcional/nulo; todos até 10000 caracteres. Autor e
hora vêm do servidor. POST de comentário adiciona registro imutável com autor,
text trim 1–10000, escopo opcional RunCase/RunStep do mesmo Run; nunca modifica
snapshots. Comentário de passo exige runCaseId. Há consulta paginada própria.

## Contratos

PlanResponse inclui casos selecionados; listas são paginadas. RunResponse
contém metadados/contexto e summary por resultado, sem carregar todas as
cópias. GET /runs/{id}/cases lista cópias paginadas; GET /cases/{runCaseId}
retorna cópia com passos. Resultados devolvem RunResponse com version atual.
IDs runCaseId/runStepId são cópias geradas, distintos dos IDs de definição.
JSON limitado a 32 KiB; snapshots retornados podem ser maiores. Swagger e
front-specs registram cada endpoint e os impactos nas permissions existentes.

## Verificação da entrega

- Node.js 24.15.0; lint, typecheck e build aprovados.
- 83 testes aprovados: 37 unitários/HTTP e 46 de integração com MySQL 8.4.11
  real via Testcontainers/Docker. Banco vazio e upgrade da Fase 03 preservam
  casos/passos/sequence counters, dados de identidade e grants customizados.
- Casos cobertos: seleção/ordenação/estados, versões concorrentes com apenas um
  sucesso/evento de auditoria, contextos indisponíveis, campos obrigatórios e
  rollback, execução manual, invalidação/reconfirmação de resultado, encerramento,
  abort parcial, comentários e alvos, autorização atual e isolamento entre
  Workspace/Project/Run/RunCase tanto na API quanto em FKs compostas.
- Aceite crítico: criar Run, alterar definição/versão/campos/opções/tags,
  editar/remover passo, arquivar campo/caso e renomear/excluir logicamente
  contexto; cópias e contexto do Run anterior permanecem iguais.
- OpenAPI exportado da aplicação: 127 operações, 24 novas. front-specs documenta
  todas com exemplos verificados contra schemas; revisão de JSON e links locais.
- A base configurada neste computador não foi migrada: os testes usam schemas
  e containers descartáveis. Aplicar 202610020004_execution na implantação.
- E-mail permanece mockado nos testes; execução automatizada, defeitos,
  integrações, reopen e governança estão fora da fase. Nenhum commit/publicação.

## Evolução de 08/10/2026

[Importação JUnit, lotes e inventários](EXECUTION_IMPORTS_20261008.md) estende a
Fase 04. A exigência de passos PASSED/SKIPPED descrita acima permanece para
resultados MANUAL; resultados externos JUNIT auditados podem permanecer com
passos pendentes inclusive na conclusão da Run. Campos de origem são aditivos.
O limite JSON é 128 KiB somente em result-imports/{previewId}/apply. Demais
corpos mantêm 32 KiB. Migração e contratos novos constam no guia da entrega.
