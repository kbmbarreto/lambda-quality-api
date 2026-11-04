# Visão geral do produto — 04/10/2026

Solicitada a rota GET /api/v1/dashboard/overview. Entrega aditiva, sem alterar
contratos dos módulos fonte, metas persistidas ou criar grant global.

## Decisões

- Uma única referência generatedAt, relógio injetável na aplicação. Janelas
  UTC semiabertas de 7/30/90 dias exatos; comparação usa o escopo atual.
- Catálogo não arquivado atual; histórico de catálogo e cobertura null,
  pois não há denominadores históricos confiáveis. Cobertura de execução:
  distintos testCaseId atuais com PASSED/FAILED/BLOCKED e executedAt no
  período, sem restringir a data de criação da execução. Média simples dos
  projetos com ambos os grants e catálogo não vazio, arredondada em duas casas.
- Resultados e progresso usam RunCases atuais de Runs criadas no período,
  incluindo SKIPPED no progresso. Distribuições incluem todos os enums.
- WorkspaceAccess resolve estado/membership/grants atuais sob lock por tenant;
  porta pública de Projects retorna contextos visíveis em lote com a mesma
  matriz local. Somente projetos ACTIVE integram fontes operacionais. Dados
  são agregados em SQL por projeto, sem carregar casos, passos ou snapshots.
- Zero/[] quando existe grant de fonte no Workspace mas não há registros
  visíveis; sem grant/Workspace visível, null. Cobertura sem base é null.
  Falha de banco interrompe a consulta com Problem Details, sem zeros falsos.
- Metas: filtro de visibilidade e grants de fonte antes do limite SQL;
  metas de Workspace com métrica de projeto exigem acesso a todos os projetos
  ativos e às fontes históricas sourceIds. Metas de projeto exigem fonte atual,
  participação e projeto ativo. Ler lastResult, sem executar calculators.
- Atividade deriva auditoria real e recursos atualmente legíveis (casos,
  Runs, defeitos, projetos, Workspace, frameworks, avaliações, metas e arquivos).
  Não retornar ator, metadata, comentários, dados pessoais ou URLs. Filtros
  por grants e fonte precedem LIMIT; eventos de outras entidades são omitidos.
- Arquivos não possuem updatedAt/versionamento; metadados disponíveis são
  imutáveis. updatedAt = createdAt e versionLabel = null, sem expor storageKey.
- Limites globais 10 projetos/eventos e 6 metas/arquivos. Queries são em lote
  por Workspace/fonte, sem consultas por caso/execução/defeito. Escopos de
  Workspaces são transações separadas, sem prometer snapshot global de banco.
- Migration aditiva de índices por Workspace/Projeto/datas de criação e
  execução, nos históricos MySQL e MariaDB. Nenhum cálculo/entidade novo.

## Verificação

- Node.js 24.15.0; build, lint e typecheck aprovados.
- 48 testes unitários/HTTP aprovados, incluindo regras de janela UTC,
  porcentagens/ausência de base, critérios de metas e OpenAPI.
- Suíte completa MySQL 8.4.11: 78 testes de integração aprovados. Total:
  126 testes distintos. Inclui os sete novos cenários da visão geral,
  índices aditivos, banco vazio e upgrade com dados/snapshots existentes.
- Sete cenários do dashboard também aprovados em MariaDB 10.11.14
  descartável, incluindo JSON_TABLE e grants/fontes históricas das metas.
- Cobertura: dias/UUID/query/bearer, catálogo vazio e ausência de fontes,
  151 casos/defeitos (além da paginação), quatro situações de Run, grupos
  zerados, janelas semiabertas e deduplicação, média simples, limites globais,
  projeto/Workspace arquivado, grants mistos e revogação imediata, metas
  ocultas antes de LIMIT, metas sem recálculo, documentos/eventos reais sem
  dados privados e falha integral em Problem Details.
- OpenAPI exportado: 170 operações, somente a nova rota; operações/schemas
  anteriores semanticamente preservados. Modelos do front e guia de
  frameworks conferidos; nenhuma alteração obrigatória nessas outras rotas.
- 381 exemplos JSON parseados e 117 destinos de links locais dos documentos
  alterados conferidos; exemplos de dashboard validados contra os schemas
  OpenAPI, incluindo tipos, chaves obrigatórias, nulos e limites.
- Testes usaram containers/schemas descartáveis; não foi aplicada migration
  ao banco configurado da aplicação. Nenhum commit ou publicação.

## Extensão de automação — 07/10/2026

- A solicitação do front acrescenta apenas metrics.automationCoverage e
  projects[].activeTestCases/automationCoverage à overview existente. As rotas
  de execução, inventário de defeitos e governança já atendem aos demais fluxos.
- Consulta SQL separada em lote por Workspace/projetos com testcase.read
  efetiva: COUNT de ACTIVE com archived_at NULL e SUM de AUTOMATED na mesma
  base. Todos os demais enums, inclusive NOT_APPLICABLE, ficam no denominador.
  Colunas e índice Workspace/Projeto/status existentes bastam; sem migration.
- Proporção global calculada com as somas antes do limite de dez projetos;
  nunca média de percentuais. Fonte independe de testrun.read/project.read e
  days. Lista mantém project.read e campos null quando não há testcase.read.
  Com acesso: base vazia 0/null por projeto, global null; manual com base >0
  retorna 0%. previousValue null por ausência de histórico confiável.
- Catalog/coverage/progress anteriores mantêm suas próprias bases e fórmulas.
  Contratos, envelope, erros e Cache-Control no-store preservados. Falha de
  infraestrutura continua integral em Problem Details; sem dados parciais.
- Testes adicionais: cinco enums de automação, quatro estados de caso e
  151 casos anteriores a days, base vazia e zero automatizado; proporção de projetos com tamanhos 90/1 e dez linhas,
  consolidação entre Workspaces, tenants privados/arquivados; grants mistos,
  contagem sem project.read/testrun.read e linha sem testcase.read.

### Verificação desta extensão

- Node.js 24.15.0: build, tipos e lint aprovados; 92 testes unitários/HTTP.
- Suíte completa: 100 testes de integração aprovados em MySQL 8.4.11 e
  os mesmos 100 em MariaDB 10.11.14, em bancos descartáveis. Os nove cenários
  de dashboard foram reconferidos nos dois bancos após reforçar as asserções
  de zero automatizado e exclusão de Workspace arquivado.
- OpenAPI mantém 179 operações; demais rotas/schemas preservados. Dois
  exemplos completos da overview conferidos contra os schemas e links
  locais da documentação alterada validados. Nenhuma migration necessária
  ou aplicada ao banco da aplicação; sem commit ou publicação.

## Metas concluídas por ações — 07/10/2026

A regra do cartão passa a ser progress = actionProgress.percent, e status
derivado das ações válidas atuais (DONE / não CANCELLED), com base positiva
para atingir. Sem base null; pendência/sem base ACTIVE ou MISSED conforme
prazo UTC. Resultado métrico lastResult/currentValue/targetValue é informativo.
Esta regra substitui o progress relativo a lastResult descrito na entrega
original. O dashboard agrega todas as metas autorizadas antes de ordenar e
limitar seis; GET nunca grava/audita/recalcula métricas.

Consultas em lote por Workspace e meta. Metas legadas usam seus vínculos atuais
sem backfill. Índices existentes bastam; sem migration. frameworkGovernance
e percentuais de framework/seções/controles mantêm as avaliações como fonte.
[Guia de integração](../front-specs/goal-action-completion.md).

## Total global ACTIVE e todo o período — 07/10/2026

- metrics.activeTestCases reutiliza COUNT ACTIVE não arquivado da projeção
  de automação, com testcase.read em todos os projetos autorizados antes do
  limite de dez. Mesmo acesso/zero/null do catálogo, sem project.read ou
  testrun.read; previousValue null. metrics.testCases mantém a base antiga.
- DashboardDays aceita 7/30/90/ALL, default 30. period.supportedDays anuncia
  as quatro opções. ALL remove somente o limite inferior SQL; to exclusivo
  continua sendo o único generatedAt capturado para toda a resposta.
- Primeira data relevante é MIN das fontes temporais autorizadas: Runs e
  defeitos por criação, resultados elegíveis de cobertura por executedAt e
  auditorias elegíveis por occurredAt. Reutiliza os filtros de atividade,
  incluindo joins tenant-scoped e leitura atual de recursos. MIN precede
  limites de listas e não considera fontes privadas, futuros ou entidades
  de auditoria não exibíveis. Em consolidação, MIN entre Workspaces ativos.
  Sem histórico, from null; catálogo/metas/documentos atuais não definem
  uma janela, exceto suas auditorias autorizadas.
- ALL deixa previousFrom/previousTo/todos previousValue null; preserva as
  fórmulas atuais, distribuições e limites 10/6. Não altera regras de ações,
  snapshots de avaliação/execução nem cria rota de preferências.
- Sem schema/migration/dependência nova. Queries agregadas por Workspace e
  fonte, sem carregar casos completos/passos/snapshots no dashboard.

### Verificação de ACTIVE e ALL

- Node.js 24.15.0: build, typecheck e lint aprovados; 94 testes unitários/HTTP.
- Suíte completa: 107 testes de integração aprovados em MySQL 8.4 e os
  mesmos 107 em MariaDB 10.11, com containers/bancos descartáveis.
- Histórico anterior a 90 dias, limite superior exclusivo/futuros, primeira
  data antes de limites, consolidação entre Workspaces, grants mistos,
  revogação, fontes privadas e Workspace arquivado verificados. Total ACTIVE
  cobre status excluídos, base vazia/sem fonte e projetos além de dez linhas.
  ALL preserva limites e indicadores atuais de metas/frameworks/documentos.
- OpenAPI mantém 179 operações; somente a rota overview mudou. Quatro
  exemplos JSON do guia foram parseados (incluindo dois completos conferidos
  contra os schemas); 111 links locais dos documentos alterados conferidos.
- Nenhuma migration aplicada ao banco da aplicação; sem commit/publicação.
