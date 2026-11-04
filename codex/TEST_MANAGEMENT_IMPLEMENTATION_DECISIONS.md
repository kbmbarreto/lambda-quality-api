# Casos de Teste — decisões da Fase 03

Solicitada em 02/10/2026. Escopo: TestSuite/TestCase/TestStep, tags, anexos e
valores personalizados. Planos, Runs, requisitos, defeitos, Shared steps e
Shared parameters não são criados nesta fase.

## Modelo e concorrência

- Suítes possuem parentSuiteId, position (base 1), timestamps e archivedAt.
  Listagem plana paginada permite reconstruir a árvore por parentSuiteId;
  filtro parentSuiteId seleciona filhos; `root=true` seleciona raízes.
  Move valida a cadeia de ancestrais e impede ciclos. Ordenação substitui
  integralmente a ordem dos irmãos ativos, sem duplicatas/omissões.
- ArchiveSuite exige ausência de filhos e casos não arquivados. Não arquiva
  implicitamente uma árvore. Suítes arquivadas ficam consultáveis; não recebem
  filhos/casos e não são alteradas. Não há restauração de suíte nesta fase.
- Casos têm sequence imutável por Workspace/Project, contador transacional
  com upsert e SELECT FOR UPDATE; ID humano = Project.key + '-' + sequence.
  Não se move caso entre projetos. Move altera apenas suiteId (null = raiz).
- Casos possuem version; PATCH/move/archive/restore e alterações de passos,
  tags, anexos/valores exigem version atual. Conflito retorna
  TEST_CASE_VERSION_CONFLICT. Archive repetido com version atual é idempotente.
  Restore exige status DRAFT/ACTIVE/DEPRECATED explícito e suíte ativa.
  Casos arquivados mantêm definição e vínculos; demais mutações são bloqueadas.
- Passos próprios são ordenados de 1 a N, até 1000 por caso. Reorder exige
  todos os IDs atuais. Atualizações usam posições temporárias positivas na
  mesma transação antes da ordem final, preservando IDs e unique no MySQL.
- Behavior é texto opcional (até 100 caracteres): os contratos não definem
  enum. Severidade NORMAL, prioridade MEDIUM, status DRAFT, tipo FUNCTIONAL,
  layer E2E e automationStatus MANUAL são defaults explícitos.
- A transação mantém o lock de Workspace usado nas fases anteriores para
  serializar autorização/mutação; contador tem também seu próprio lock.
  Esta escolha prioriza consistência; limita throughput de um único tenant.
  Ports de persistência seguem a composição transacional já existente;
  domínio e aplicação continuam independentes de NestJS/Prisma.

## Catálogos, valores e arquivos

- CustomFieldValue pertence a caso/projeto e referencia definição do mesmo
  tenant por FK composta. JSON escalar: TEXT string até 10000 caracteres;
  NUMBER finito; BOOLEAN boolean; DATE YYYY-MM-DD real (1000–9999);
  SINGLE_SELECT UUID da opção. Null remove valor. Rejeitar duplicatas,
  definições de outro tenant/alvo, arquivadas ou valores incompatíveis.
- Create, PATCH, restore, clone e PUT de valores validam todos os campos
  ativos obrigatórios. Criar um novo obrigatório não reescreve casos antigos:
  PATCH/restore exigem preenchê-lo. PUT substitui valores ativos; valores de
  definições arquivadas são preservados e continuam legíveis.
- Clone gera novos IDs/sequence e copia definição, passos e tags; copia só
  valores de definições ativas, validando obrigatoriedade atual. Anexos são
  referências aos arquivos existentes; não duplica bytes. Exige create/read
  no projeto e attachment.read quando copia anexos; arquivos excluídos são
  ignorados. Clone de caso arquivado é permitido; novo caso nasce DRAFT.
- TestCaseTag e TestCaseAttachment possuem projectId e FKs compostas para
  caso; tags/arquivos permanecem do Workspace. Vínculos não expõem storageKey.
  Associar/desassociar anexos exige testcase.update e attachment.read.
  Downloads mantêm endpoints e autorização da biblioteca de Workspace.
- Tag vinculada não pode ser apagada: 409 TAG_IN_USE, até desvincular os casos,
  incluindo arquivados. Anexo excluído mantém vínculo histórico; nova associação
  é rejeitada. O caso retorna somente attachmentIds de arquivos não excluídos,
  e tagIds; metadados/bytes continuam exigindo permissions do catálogo/biblioteca.

## Acesso e migração

Quatro novas permissions: testcase.read/create/update/archive. Administrator
recebe todas; Member recebe somente testcase.read. Roles customizadas não
recebem grants automaticamente. VIEWER permite read, EDITOR permite
read/create/update, MANAGER inclui archive; capabilities locais intersectam
permissions atuais. project.manage_all dispensa vínculo sem dispensar a ação.
A matriz e permissions retornadas nos endpoints de Projetos são ampliadas.
Migração aditiva, com FKs RESTRICT e CHECKs SQL documentados; sem hard delete
normal de casos ou suítes. Auditoria acompanha cada mutação na transação.

A atribuição de ProjectMember preserva a prevenção de escalada existente:
o ator precisa das capabilities da role local atribuída, incluindo as novas
permissions de casos. Roles customizadas administrativas podem precisar de
grants explícitos antes de atribuir EDITOR/MANAGER.

## Verificação da entrega

- Node.js 24.15.0; lint, typecheck e build aprovados.
- `npm run test:all`: 68 testes aprovados (33 unitários/HTTP e 35 de
  integração), em oito arquivos. MySQL 8.4.11 em containers descartáveis.
- Migrations aplicadas via migrate deploy em banco vazio e em upgrade
  Fase 01 → Fase 02 com Projeto/grants existentes → Fase 03; registros
  anteriores e roles customizadas preservados.
- Cobertura de ciclos/ordenação, sequence concorrente/rollback, conflitos
  de version, clone independente e valores ativos, archive/restore com
  destino arquivado/novos obrigatórios, tipos escalares, vínculos privados,
  revogação e fronteiras de tenant/projeto, incluindo FKs no banco.
- OpenAPI exportado do servidor de teste: 103 operações, 25 novas.
  Conferidos 227 exemplos JSON dos guias e documentos, exemplos de request/
  response dos 25 endpoints contra os schemas OpenAPI e links locais.
- Não aplicada migration ao banco configurado; nenhum envio real de e-mail,
  commit ou publicação. npm ci/CI não foi executado nesta máquina; dependências
  existentes foram usadas, sem alterar o lockfile previamente modificado.
- O primeiro teste de inicialização de um segundo container sofreu timeout
  de porta no Docker recém-iniciado; duas execuções completas posteriores
  passaram. Validação automatizada não confirma entrega real de SendGrid.
- Histórico verificado nesta fase significa preservar registros arquivados
  e independência dos clones; snapshots de execução serão validados na Fase 04.

## Evolução: contagens do repositório — 03/10/2026

Rota aditiva `GET .../test-cases/summary`, operação `getTestCaseSummary`,
com DTO próprio aceitando apenas status opcional. Mesma autorização efetiva
`testcase.read` em Projects.run, incluindo consulta de projetos arquivados.
Rota estática antes de `:caseId` para preservar a validação de UUID v4.

Port transacional summarizeTestCases agrupa por suite_id em uma consulta
SQL parametrizada, restringindo workspace_id e project_id. status exato
usa a coluna status; ALL não restringe situação; ausência usa archived_at
IS NULL, idêntico à listagem. Nenhum agregado completo, passo ou vínculo
é carregado; contagens BigInt do driver são convertidas para números JSON.
Total do projeto é a soma dos grupos diretos da mesma consulta, sem duplicar
descendentes nem executar uma segunda contagem. Grupos vazios omitidos e
projeto vazio retorna totalCases=0/suites=[]. Sem migration.

Guias/front-specs e OpenAPI registram o contrato e a transição do fallback
de listagens; atualizar o servidor e recarregar o front para detectar a rota.

Verificação desta evolução:

- Node.js 24.15.0; build, typecheck e lint aprovados.
- 45 testes unitários/HTTP e 71 de integração aprovados (116 testes), com
  MySQL 8.4.11 em containers descartáveis; inclui os quatro novos testes
  de summary e regressão das fases existentes.
- Os quatro novos testes também aprovados em MariaDB 10.11.14 descartável:
  sem suíte/vazio/pai-filho, todas as situações, projeto arquivado,
  isolamento, sessão/grants/revogação e validação UUID/query/rota estática.
- OpenAPI exportado do servidor de teste: 169 operações; somente uma nova
  rota e dois schemas de resposta, sem mudanças em operações/schemas anteriores.
- 378 exemplos JSON documentais parseados, 157 destinos de links locais
  dos guias alterados verificados e exemplos de summary conferidos com
  o contrato OpenAPI; git diff --check aprovado.
- Sem migration nesta evolução; testes usaram bancos descartáveis, sem
  alterar o banco configurado da aplicação. Nenhum commit ou publicação.
