# Execuções — importação JUnit, lotes e inventários (08/10/2026)

O usuário autorizou todas as propostas do front: PASSED externo com passos
pendentes, importação com prévia/recibo, inclusão atômica em planos e inventários
globais paginados de execuções e projetos. Não há consulta remota ao Azure/CI.

## Decisões de domínio e persistência

- Resultado externo pertence ao **caso da execução**, com resultOrigin JUNIT e
  externalResult contendo origem, importId/itemId, nome/hash do relatório e
  detalhes analisados. A origem MANUAL da criação da execução permanece igual.
- PASSED externo não exige resultados fictícios nos passos, também ao concluir
  a execução. Casos manuais preservam a exigência PASSED/SKIPPED dos passos.
  Todas as cópias e snapshots de definição ficam preservados.
- Editar um passo invalida o resultado do caso, volta para NOT_TESTED/MANUAL e
  limpa externalResult. Resultado manual limpa origem externa. Comentários
  existentes não são substituídos por importação.
- Prévia dura 30 minutos para aplicação e pertence ao autor. Consulta de recibo
  exige grants atuais e escopo completo, inclusive em projeto arquivado. Prévia
  grava apenas um documento de preparação, sem mudar a execução.
- Nome/hash SHA-256 e itens analisados ficam no banco; não armazenar XML bruto,
  não escrever arquivos locais e não criar anexos na biblioteca/OCI. A ferramenta
  do contrato é JUNIT. Detalhes do relatório só são retornados em consultas
  autorizadas e não entram em logs/auditoria de texto livre.
- Uma prévia aplica uma seleção única. Mapeamentos são explícitos, sem inferência
  por título. Ambiguidades, IDs inválidos/ausentes, resultados repetidos e casos
  fora do snapshot recebem avisos e exigem revisão manual do destino.
- A aplicação valida todos os itens/destinos e permissões na transação antes de
  gravar qualquer resultado. Incrementa TestRun.version uma vez, mantém o run
  em andamento, grava recibo e evento test.run_results_imported atomicamente.
- requestKey UUID v4 é único por Workspace/projeto/run. Hash do pedido usa versão,
  overwrite normalizado e mappings ordenados por itemId. Replay confirmado com
  mesmos dados retorna recibo e run atual sem escrita; payload divergente gera
  TEST_RESULT_IMPORT_KEY_CONFLICT. Outro autor não acessa/reaplica recibo.
- Recibos permanecem após expiração; GET distingue PREVIEW/EXPIRED/APPLIED. Não
  há limpeza automática nesta entrega. Não expõe XML bruto, senha ou URL de storage.
- JSON de apply admite 128 KiB somente nessa rota; todos os demais corpos
  permanecem com 32 KiB. XML multipart admite 2 MiB e até 500 resultados.
- Parsing SAX via saxes 6.0.0, fixado no lockfile, sem resolver entidades externas;
  UTF-8 estrito, sem DTD/entidades personalizadas, profundidade limitada a 64.
  API de eventos conferida no [projeto do parser](https://github.com/lddubeau/saxes)
  e nos tipos instalados. A camada de aplicação recebe o parser por injeção;
  domínio/aplicação permanecem independentes do framework e do parser XML.

## Inclusão em lote

POST test-plans/{planId}/cases/bulk permite 1–500 novos IDs em plano DRAFT,
na ordem recebida, com máximo 500 somando a seleção atual. Rejeita repetidos,
IDs já selecionados e casos indisponíveis/fora do projeto antes de inserir.
Uma versão/auditoria por lote; sem requestKey. Em resposta incerta, consultar
seleção/versão antes de reenviar. POST individual permanece compatível.

## Inventários e isolamento

- GET test-runs agrega todos os projetos com testrun.read e participação atual,
  incluindo arquivados. GET dashboard/projects usa project.read e devolve
  indicadores apenas com testcase.read, independentemente dos demais grants.
- Autorização, paginação e agregações usam a mesma transação e os mesmos locks
  de Workspace usados nas mutações de membership/grants. Locks são adquiridos
  em ordem de UUID para reduzir deadlocks; Workspaces removidos durante a
  descoberta são revalidados na transação.
- O adapter oferece inventory com transação global e repositórios scoped para
  resolução de cada Workspace. Um repositório scoped não pode trocar de tenant.
  Consultas globais recebem somente IDs autorizados. Filtros, count e página
  são executados no SQL depois de determinar a visibilidade.
- Resumos de resultados e automação usam COUNT/GROUP BY somente dos IDs da
  página, sem carregar passos/definições. Ordenação estável com desempate id ASC.
- Contagens ACTIVE são zero quando autorizadas e vazias; indicadores são null
  sem fonte autorizada, e porcentagem null quando a base é vazia. Projetos
  arquivados podem ser solicitados explicitamente no inventário de projetos.
- Nenhum novo grant, nenhum indicador modificado na overview e nenhum limite
  global novo de requisições. Front deixa de enumerar dados completos para paginar.

## Operação e compatibilidade

Migration aditiva `202610080001_result_imports` nas histórias MySQL e MariaDB:
campos de origem no TestRunCase e tabela test_result_imports com FK composta de
Workspace/projeto/run e índice único de requestKey. Registros históricos
continuam MANUAL, sem origem externa; resultados/snapshots preservados.

Aplicar com `npm run migration:deploy` antes de iniciar a API atualizada no
DATABASE_DIALECT existente. Não aplicar migrations ao banco real durante os
testes; não alternar dialeto, resetar banco ou alterar migrations anteriores.
Docker/OCI não precisam de novas variáveis de ambiente para esta entrega.

Seis novas operações: previewTestRunResultImport, applyTestRunResultImport,
getTestRunResultImport, addTestPlanCasesBulk, listTestRunInventory e
listDashboardProjects. OpenAPI passa de 179 para 185 operações.
[Guia completo do front](../front-specs/execution-imports-and-inventories.md).

## Validação

Node.js 24.15.0: build, typecheck e lint aprovados; 111 testes unitários/HTTP
aprovados; 116 testes de integração aprovados em cada dialeto, MySQL 8.4.11
e MariaDB 10.11.14 descartáveis. Os testes verificam bootstrap/upgrade com dados
históricos, FK composta, snapshots, grants/isolamento, atomicidade de lotes e
importação, reenvio concorrente, falha antes da auditoria com rollback completo,
versão/expiração/overwrite, conclusão externa e regra manual, limites 500/2 MiB,
JSON apply acima de 32 KiB e rejeição acima de 128 KiB, paginação e indicadores.

E-mail e storage externos são simulados; frontend Angular não é alterado.
Banco da aplicação não foi migrado e não houve deploy ou commit. O operador
precisa aplicar a migration no ambiente alvo antes de iniciar a API atualizada.
