# Visão geral do produto — integração do Início

## Funcionalidade: dashboard consolidado

- **Disponibilidade:** implementado em 04/10/2026, API v1.
- **Última atualização:** 07/10/2026 — total global ACTIVE e todo o período (ALL).
- **Referência OpenAPI:** `getDashboardOverview`, `/docs-json` e [snapshot](openapi.json).
- **Resumo:** inventário atual, comparações temporais, cobertura de execução/automação,
  resultados, projetos, atividades, metas persistidas e biblioteca de arquivos.
- **Contrato:** compatível com `DashboardOverview` de
  `src/app/features/home/dashboard.models.ts` do front. Perfil/autenticação e
  repositório de frameworks preservam rotas existentes; extensão de acompanhamento abaixo.

## GET /api/v1/dashboard/overview

### Objetivo e acesso

Bearer válido e sessão atual. Nenhum novo grant global: os blocos são filtrados
pelos grants de suas fontes e pela participação atual nos projetos, incluindo
roles diretas/grupos e `project.manage_all` conforme a matriz vigente.
Workspace/membro precisam estar ACTIVE. Somente projetos ACTIVE participam das
fontes operacionais e da lista de projetos. Projetos/Workspaces invisíveis não
entram em nenhuma soma. workspaceId vem da seleção atual, se houver.

Sem workspaceId, consolida todos os Workspaces acessíveis. Workspace explícito
inexistente, arquivado, suspenso ou sem membro ativo retorna 404 genérico.
Acesso atual é resolvido no servidor; claims de roles não autorizam os dados.

| Fonte/bloco | Acesso atual |
| --- | --- |
| Catálogo de casos | testcase.read efetiva em cada projeto |
| Runs e resultados | testrun.read efetiva em cada projeto |
| Defeitos | defect.read efetiva em cada projeto |
| Cobertura de execução | testcase.read e testrun.read efetivas no mesmo projeto |
| Casos ativos e cobertura de automação | testcase.read efetiva em cada projeto; não exige testrun.read |
| Projetos | project.read efetiva e acesso de participação/manage_all |
| Frameworks atuais | governance.read no Workspace; frameworks ACTIVE |
| Metas | governance.read; projeto e grants de fonte conforme escopo/tipo |
| Documentos | attachment.read no Workspace |
| Atividade | Grant de leitura da entidade fonte e acesso atual ao recurso |

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer accessToken | Sim | Identidade/sessão válida |
| header | X-Request-Id | UUID v4 | Não | Gerado quando ausente |
| query | days | 7, 30, 90 ou literal ALL | Não | 30; dias exatos de 24 horas ou todo o histórico autorizado |
| query | workspaceId | UUID v4 | Não | Ausente consolida os Workspaces acessíveis |

Sem body, paginação, status, busca ou ordenação customizada. Query inesperada,
UUID/enum inválido, dias vazios/fracionários ou parâmetros repetidos geram 400.

```http
GET /api/v1/dashboard/overview?days=30&workspaceId=11111111-1111-4111-8111-111111111111
Authorization: Bearer <accessToken>
X-Request-Id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

Consolidação de todos os Workspaces:

```http
GET /api/v1/dashboard/overview?days=7
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP **200**, Content-Type application/json, Cache-Control: no-store,
X-Request-Id. Sem Location nem meta.pagination. Envelope `data/message/meta`.
Todas as chaves abaixo são obrigatórias, inclusive os valores null.

```json
{
  "data": {
    "generatedAt": "2026-10-04T09:00:00.000-03:00",
    "period": {
      "days": 30,
      "from": "2026-09-04T09:00:00.000-03:00",
      "to": "2026-10-04T09:00:00.000-03:00",
      "previousFrom": "2026-08-05T09:00:00.000-03:00",
      "previousTo": "2026-09-04T09:00:00.000-03:00",
      "supportedDays": [
        7,
        30,
        90,
        "ALL"
      ]
    },
    "metrics": {
      "testCases": {
        "value": 2,
        "previousValue": null
      },
      "executions": {
        "value": 2,
        "previousValue": 1
      },
      "defects": {
        "value": 1,
        "previousValue": 2
      },
      "coverage": {
        "value": 100,
        "previousValue": null
      },
      "automationCoverage": {
        "value": 50,
        "previousValue": null
      },
      "activeTestCases": {
        "value": 2,
        "previousValue": null
      }
    },
    "results": {
      "NOT_TESTED": 0,
      "PASSED": 2,
      "FAILED": 1,
      "BLOCKED": 0,
      "SKIPPED": 1
    },
    "defectsByStatus": {
      "OPEN": 1,
      "IN_PROGRESS": 0,
      "RESOLVED": 0,
      "CLOSED": 0,
      "REJECTED": 0
    },
    "projects": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "workspaceId": "11111111-1111-4111-8111-111111111111",
        "workspaceName": "Equipe de qualidade",
        "key": "PORTAL",
        "name": "Portal",
        "status": "ACTIVE",
        "progress": 100,
        "coverage": 100,
        "activeTestCases": 2,
        "automationCoverage": 50
      }
    ],
    "activity": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "title": "Atividade em caso de teste",
        "context": "Equipe de qualidade / PORTAL: Portal",
        "occurredAt": "2026-10-03T12:00:00.000-03:00",
        "target": {
          "module": "TEST_CASES",
          "workspaceId": "11111111-1111-4111-8111-111111111111",
          "projectId": "22222222-2222-4222-8222-222222222222"
        }
      }
    ],
    "governance": [
      {
        "id": "44444444-4444-4444-8444-444444444444",
        "workspaceId": "11111111-1111-4111-8111-111111111111",
        "name": "Meta interna de automação",
        "frameworkName": null,
        "progress": 50,
        "detail": "Ações concluídas: 1 de 2 (50%). Canceladas: 0.",
        "status": "ACTIVE",
        "frameworkId": null,
        "sectionId": null,
        "sectionName": null,
        "ownerDisplayName": null,
        "currentValue": 40,
        "targetValue": 80,
        "deadline": null,
        "calculatedAt": "2026-10-02T07:00:00.000-03:00",
        "actionProgress": {
          "basis": "ACTIONS",
          "totalActions": 2,
          "completedActions": 1,
          "cancelledActions": 0,
          "percent": 50
        }
      }
    ],
    "documents": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "workspaceId": "11111111-1111-4111-8111-111111111111",
        "name": "referencia.txt",
        "versionLabel": null,
        "updatedAt": "2026-10-02T06:00:00.000-03:00"
      }
    ],
    "frameworkGovernance": {
      "indicatorType": "INTERNAL",
      "generatedAt": "2026-10-04T09:00:00.000-03:00",
      "frameworkCount": 0,
      "frameworksWithAssessment": 0,
      "overall": null,
      "frameworks": [],
      "attention": {
        "notAssessedControls": 0,
        "notMetControls": 0,
        "partiallyMetControls": 0,
        "expiredEvidence": 0,
        "upcomingGoals": 0
      }
    }
  },
  "message": "Visão geral consultada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-04T09:00:00.050-03:00"
  }
}
```

`generatedAt` é a referência do cálculo, capturada uma única vez;
meta.timestamp é o instante do envelope. Nas opções numéricas, a janela
corrente é `[from,to)` e a anterior `[previousFrom,previousTo)`, com previousTo = from e to = generatedAt.
O front deve exibir esses limites efetivos em UTC/local, sem recalcular a
janela pelo seu próprio relógio. Contagens são inteiros não negativos;
percentuais são números entre 0 e 100, arredondados a até duas casas.

#### Todo o período (ALL)

```http
GET /api/v1/dashboard/overview?days=ALL&workspaceId=11111111-1111-4111-8111-111111111111
Authorization: Bearer <accessToken>
```

`period.supportedDays` é sempre `[7, 30, 90, "ALL"]` nesta versão, inclusive
nas janelas numéricas. O padrão permanece 30. `ALL` é literal maiúsculo;
`all`, espaços, queries inesperadas e parâmetros repetidos são inválidos.

Em ALL, consultas temporais não têm limite inferior e preservam o limite
superior exclusivo `period.to = generatedAt`, descartando registros futuros.
`period.from` informa o menor instante **autorizado** dentre criação de Runs,
criação de defeitos, `executedAt` dos resultados PASSED/FAILED/BLOCKED de casos
atuais não arquivados com ambos os grants, e auditorias elegíveis à atividade.
As mesmas regras de grants/participação/visibilidade são aplicadas antes dessa
agregação, incluindo eventos além dos dez exibidos e projetos além da tabela.
Sem esses registros, `from = null`. Datas de catálogo, metas e documentos
atuais não definem o início, mas uma auditoria visível dessas entidades pode
defini-lo. A consolidação toma o menor instante entre Workspaces autorizados.

`previousFrom`, `previousTo` e **todos** os `metrics.*.previousValue` são null
em ALL. Resultados continuam usando o resultado atual de RunCases de Runs
criadas antes de `to`; defeitos continuam agrupados pela situação atual.
Cobertura de execução usa todo `executedAt` elegível anterior a `to`.
Projetos/atividade continuam com até dez itens; metas/documentos, até seis.
Catálogo, automação, conclusão de ações e frameworks continuam atuais.

Exemplo **parcial**, sem fontes históricas acessíveis:

```json
{
  "period": {
    "days": "ALL",
    "supportedDays": [7, 30, 90, "ALL"],
    "from": null,
    "to": "2026-10-07T16:00:00.000-03:00",
    "previousFrom": null,
    "previousTo": null
  },
  "metrics": {
    "activeTestCases": { "value": 125, "previousValue": null }
  }
}
```

#### Indicadores e distribuições

- **activeTestCases.value:** total global de ACTIVE com archivedAt null em
  todos os projetos/Workspaces ativos autorizados com testcase.read, antes
  dos limites de listas. Reutiliza os totais SQL de automação; não exige
  project.read ou testrun.read. Independe de days (incluindo ALL). Sem fonte
  acessível null; inventário autorizado vazio 0. previousValue sempre null
  por ausência de histórico de status. O cartão Casos de teste usa somente
  este campo; se ausente durante rollout, mostrar “—”, sem usar testCases.
- **testCases.value:** casos atuais não arquivados, incluindo DRAFT, ACTIVE
  e DEPRECATED. previousValue sempre null nesta entrega: não existe fonte
  confiável para o catálogo histórico na abertura do período.
- **executions:** TestRuns criadas na janela correspondente, em qualquer
  situação CREATED/IN_PROGRESS/COMPLETED/ABORTED, no escopo autorizado atual.
- **defects:** defeitos criados na janela correspondente, em todas as situações,
  no mesmo escopo autorizado atual. Não compara grants históricos.
- **coverage:** média simples das coberturas dos projetos com ambos os grants
  e catálogo não vazio. Por projeto: 100 × casos atuais distintos com resultado
  PASSED/FAILED/BLOCKED e executedAt na janela / casos não arquivados atuais.
  Deduplicar testCaseId entre versões/Runs; a data de criação da Run não limita
  essa cobertura. SKIPPED/NOT_TESTED não exercitam casos. Denominador zero ou
  nenhuma base retorna null. previousValue sempre null por falta de denominador
  histórico confiável. Esta cobertura é de execução; não é de requisitos nem
  de automação. A média usa todos os projetos autorizados, além das 10 linhas.
- **automationCoverage:** catálogo atual, sem filtro por `days`, criação ou
  execução. Base = casos `status = ACTIVE` e `archivedAt = null`; DRAFT,
  DEPRECATED e ARCHIVED ficam fora. Numerador = casos dessa base com
  `automationStatus = AUTOMATED`. MANUAL, TO_BE_AUTOMATED, IN_PROGRESS e
  NOT_APPLICABLE não somam no numerador; **NOT_APPLICABLE continua no
  denominador**. Global = 100 × soma de automatizados ativos / soma de casos
  ativos em todos os projetos autorizados, além das dez linhas da tabela.
  É proporção consolidada, não média simples. Exemplo: 90 casos manuais num
  projeto e dez automatizados em outro resultam em 10%, não 50%. Exige somente
  testcase.read efetiva, independente de project.read/testrun.read para o
  cartão. Denominador vazio/sem acesso: value null; base não vazia sem
  automatizados: value 0. Arredondamento até duas casas. previousValue sempre
  null: não há histórico confiável de status e automação na abertura do período.
- **results:** soma dos resultados atuais dos RunCases das Runs criadas no
  período, equivalente à soma de TestRun.summary. Inclui todos os cinco enums,
  mesmo com zero; snapshots de casos atualmente arquivados continuam no gráfico.
  O total do gráfico “Resultados de testes” pode diferir do cartão “Execuções”.
- **defectsByStatus:** status atual dos defeitos criados no período, nos cinco
  enums OPEN/IN_PROGRESS/RESOLVED/CLOSED/REJECTED; não traduzir para estados novos.

#### Listas resumidas

- **projects:** até 10, updatedAt DESC/id ASC, somente ACTIVE. progress é o
  percentual de RunCases diferentes de NOT_TESTED em Runs criadas no período;
  SKIPPED conta como encerrado aqui. Sem testrun.read/denominador, progress null.
  Sem ambos os grants/base de catálogo, coverage null. Os novos campos
  **activeTestCases** (inteiro >= 0) e **automationCoverage** usam a mesma base
  ACTIVE não arquivada descrita acima. Sem testcase.read: ambos null. Com
  acesso e base vazia: 0/null; base não vazia sem automatizados: contagem/0.
  A lista continua exigindo project.read, sem limitar o agregado global.
  “Ver todos” abre Projetos.
- **activity:** até 10 eventos reais de audit_events na janela, occurredAt DESC/
  id ASC. Somente entidades atualmente acessíveis: casos, Runs, defeitos,
  projetos ativos, Workspace, frameworks, avaliações, metas e arquivos disponíveis.
  Grants e visibilidade são aplicados antes de limitar. Não inclui eventos de
  identidade/membros/convites, ator, metadata, comentários ou dados pessoais.
  Não cria eventos a partir de updatedAt. title/context têm até 250 caracteres.
  `target.module` usa TEST_CASES/EXECUTION/DEFECTS/GOVERNANCE/PROJECT/WORKSPACE;
  projectId é UUID para módulos de projeto e null quando não aplicável.
  Usar os targets para construir rotas locais; a API não retorna URLs arbitrárias.
- **governance:** até 6 metas ACTIVE/ACHIEVED/MISSED; ACTIVE primeiro, deadline
  crescente, sem prazo por último, id ASC. Metas de projeto exigem projeto ativo,
  acesso e grant de sua fonte; metas de Workspace com métricas de projeto exigem
  acesso a todos os projetos ativos e fontes históricas de lastResult.sourceIds.
  Ausência de acesso omite a meta antes do limite. Apenas lastResult persistido:
  sem recalcular, mudar status/version ou gravar auditoria ao abrir o Início.
  Desde 07/10/2026, **progress = actionProgress.percent**: percentual de ações
  DONE entre todas as vinculadas não CANCELLED. Ao menos uma válida e todas DONE
  => status ACHIEVED; com pendência/sem base, ACTIVE ou MISSED conforme prazo UTC.
  Sem ações válidas: progress null. Não depende de targetValue/operator/lastResult
  nem da paginação de ações. actionProgress contém basis ACTIONS, totalActions,
  completedActions, cancelledActions e percent. detail descreve esses totais.
  currentValue/targetValue/calculatedAt preservam a métrica informativa.
  Não usar lastResult/currentValue para desenhar o círculo de conclusão.
  Ordenação e limite global de seis metas aplicados após derivar o status; metas
  existentes refletem as ações atuais sem escrever, auditar ou calcular a métrica
  em GET. [Fluxo de integração](goal-action-completion.md).
- **documents:** até 6 arquivos não excluídos da biblioteca de Workspace,
  atualização DESC/id ASC, sem filtro por período. O modelo tem metadados
  imutáveis e somente createdAt: updatedAt representa essa criação.
  versionLabel sempre null, sem criar versionamento. Apenas id/workspaceId/name/
  versionLabel/updatedAt, sem bytes, URL, storageKey ou credenciais. Links abrem
  Workspace para downloads nas rotas autenticadas da biblioteca.

#### frameworkGovernance — extensão de 04/10/2026

Bloco adicional obrigatório/null, preservando todos os campos anteriores. Sem
fonte/grant de governança em Workspace ativo: null. Com grant, mesmo sem frameworks:
objeto com counts zero, frameworks [], overall null e attention zerado.

| Campo | Contrato |
| --- | --- |
| indicatorType / generatedAt | INTERNAL e mesmo instante da overview, apresentado com -03:00 |
| frameworkCount | todos os frameworks ACTIVE do escopo autorizado |
| frameworksWithAssessment | frameworks com fonte IN_PROGRESS/CLOSED selecionada |
| overall | ProgressSummary/null; contagens e numeradores/denominadores de uma fonte por framework |
| frameworks | todos os frameworks, sem truncamento; workspaceName/workspaceId/frameworkName/frameworkId ASC |
| attention | notAssessedControls, notMetControls, partiallyMetControls, expiredEvidence, upcomingGoals; inteiros >=0 |

Cada framework: workspaceId/workspaceName, frameworkId/frameworkName, state,
assessment, definitionVersionDiffers, summary e sections. state/assessment/summary
seguem [progresso](framework-progress.md). sections contém só raízes do snapshot,
com id/code/name e summary=subtree. Nunca somar raiz e descendentes no overall.
Framework sem avaliação retorna NO_ASSESSMENT, assessment/summary null e sections [];
não entra no consolidado como zero. Sem fontes, overall null.

Seleção/fórmulas iguais ao detalhe: IN_PROGRESS recente, senão CLOSED, sem DRAFT.
Posição atual não é limitada por days. Alertas de controles e evidências usam
essas mesmas avaliações; evidência expirou quando validUntil < hoje UTC. Sua
expiração não reclassifica controle. upcomingGoals conta todas as metas ACTIVE
visíveis pelas regras de governance, prazo hoje..hoje+30 inclusive, além dos seis
cartões. Sem recálculo/status/auditoria em GET.

`governance` preserva progress/detail e acrescenta em cada meta frameworkId,
sectionId, sectionName, ownerDisplayName, currentValue, targetValue, deadline e
calculatedAt. targetValue é sempre numérico; demais campos são nullable quando
inaplicáveis/sem resultado. Nome da seção após cálculo vem do snapshot persistido;
antes, do catálogo. Nome público do membro ativo, sem e-mail. O lastResult informativo de metas GOVERNANCE_SCORE continua usando CLOSED,
mesmo que o framework mostre IN_PROGRESS. Seu status/progresso é por ações.
Exibir fonte/data da meta; diferenças entre valores são legítimas. Clique no
framework passa workspaceId/frameworkId/assessment.id ao acompanhamento.

#### Nulos e vazio

Sem grant/fonte autorizada, o bloco é null. Com grant da fonte em Workspace
acessível e nenhum registro/projeto operacional visível, retorna zero/[];
zero não representa falha. Cobertura de execução/automação sem base é null mesmo com grants.
Em consolidação com grants mistos, cada bloco soma somente os escopos
atualmente autorizados. Usuário sem qualquer fonte recebe 200:

```json
{
  "data": {
    "generatedAt": "2026-10-04T09:00:00.000-03:00",
    "period": {
      "days": 30,
      "from": "2026-09-04T09:00:00.000-03:00",
      "to": "2026-10-04T09:00:00.000-03:00",
      "previousFrom": "2026-08-05T09:00:00.000-03:00",
      "previousTo": "2026-09-04T09:00:00.000-03:00",
      "supportedDays": [
        7,
        30,
        90,
        "ALL"
      ]
    },
    "metrics": {
      "testCases": {
        "value": null,
        "previousValue": null
      },
      "executions": {
        "value": null,
        "previousValue": null
      },
      "defects": {
        "value": null,
        "previousValue": null
      },
      "coverage": {
        "value": null,
        "previousValue": null
      },
      "automationCoverage": {
        "value": null,
        "previousValue": null
      },
      "activeTestCases": {
        "value": null,
        "previousValue": null
      }
    },
    "results": null,
    "defectsByStatus": null,
    "projects": null,
    "activity": null,
    "governance": null,
    "documents": null,
    "frameworkGovernance": null
  },
  "message": "Visão geral consultada com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-04T09:00:00.050-03:00"
  }
}
```

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Query inesperada, dias/UUID inválido ou parâmetro repetido | Associar errors[].field; corrigir o filtro |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Bearer/sessão inválido | Seguir autenticação; evitar renovação em loop |
| 403 | AUTH_FORBIDDEN | Política de autorização aplicável no escopo visível | Revalidar acesso; não substituir por zeros |
| 404 | RESOURCE_NOT_FOUND | Workspace explícito inexistente/invisível/inativo ou versão antiga sem rota | Mostrar painel indisponível conforme contexto; manter atalhos |
| 500 | INTERNAL_ERROR | Falha inesperada | Preservar requestId para diagnóstico |
| 503 | SERVICE_UNAVAILABLE | Falha de infraestrutura/concorrência | Mostrar erro e permitir tentativa manual |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/dashboard/overview",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-04T09:00:00.050-03:00"
}
```

Falhas do banco/consulta inteira retornam Problem Details, nunca sucesso com
zeros ou dados parciais de outros Workspaces. Não há degradação silenciosa de
fontes nesta versão. errors identifica os campos sem expor valores rejeitados.
Preservar requestId; timeout/rede não é resposta HTTP. A consulta é idempotente
mas o front não deve fazer polling ou repetição automática nesta integração.

### Fluxo de integração

1. Habilitar “Todo o período” quando period.supportedDays contiver ALL.
   Sem anúncio de suporte, manter 7/30/90; se a preferência salva for ALL,
   usar 30 e avisar. Preferências locais por conta/origem usam localStorage,
   sem tokens/senhas/dados de projeto e sem nova rota. Conferir Workspaces
   ativos acessíveis antes de restaurar o filtro. Selecionar dias e Workspace
   opcional, iniciar loading e cancelar consulta
   anterior ao mudar filtros/sessão/escopo.
2. Enviar uma overview com bearer; usar generatedAt/period como referência.
3. Exibir null como indisponível/sem base, zero como consulta vazia. Gráficos
   respeitam os enums originais; cartões usam todos os registros autorizados.
4. Usar target nas atividades e IDs de Workspace/projeto nas listas para rotas
   locais; manter “Ver todos” nas rotas existentes.
5. Usar exclusivamente metrics.activeTestCases no cartão Casos de teste;
   não somar a tabela nem substituir pelo catálogo antigo. Em ALL, ocultar
   comparações anteriores e aceitar from null. Usar metrics.automationCoverage
   no cartão de automação e os campos
   activeTestCases/automationCoverage nas colunas de projetos. Nunca substituir
   por metrics.coverage, projects[].coverage ou progress: medem execução.
   Exibir null ou campos ainda ausentes como “—”; não inferir histórico nem
   criar uma variação quando previousValue é null. Sem cálculos por paginação
   no navegador. As contagens de metas pela lista governance representam
   somente as até seis metas exibidas, não o inventário global.
6. Encerrar loading e tratar HTTP/code, sem polling. Não iniciar cálculo de
   metas nem downloads de arquivos ao abrir a página. Remover dados no logout.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Total ACTIVE e ALL em 07/10/2026:** metrics.activeTestCases e
  period.supportedDays são obrigatórios nesta versão. days aceita string ALL
  além dos inteiros; from/previousFrom/previousTo podem ser null. Atualizar
  modelos TypeScript e consumidores gerados. Clientes com janelas numéricas
  mantêm comportamento e default; metrics.testCases preserva a semântica
  anterior. Sem migration, nova rota ou mudança nas permissões/envelopes.

- **Conclusão de metas em 07/10/2026:** progress/status/detail passam a usar
  ações atuais, com actionProgress obrigatório. Atualizar as legendas do front;
  sem nova rota/migration. FrameworkGovernance permanece independente.
- **Tipo da entrega:** rota aditiva em 04/10/2026, extensão frameworkGovernance/metas
  na mesma data e extensão de automação em **07/10/2026**; API v1.
- **Extensão de automação:** metrics.automationCoverage e
  projects[].activeTestCases/automationCoverage são adicionais e obrigatórios
  na versão atual. Fronts toleram ausência durante rollout como “—”. Mesmos
  filtros, envelopes, no-store, grants e erros. Nenhuma migration nova,
  nenhuma rota adicional ou mudança obrigatória nas rotas de execução.
  projectName no inventário de defeitos e os blocos existentes de governança
  continuam suficientes para os demais ajustes de interface solicitados.
- **Mudança:** dashboard consolidado sem alterar Casos/Execuções/Defeitos/
  autenticação; evolução aditiva de Governança, sem novo grant global.
- **Impacto:** front pode usar diretamente o contrato proposto. Cobertura
  confirmada como execução, histórico indisponível nullable e documentos
  com updatedAt de criação/versionLabel null.
- **Migração:** aplicar `npm run migration:deploy` com DATABASE_DIALECT correto
  antes do rollout; `202610040007_dashboard_indexes` acrescenta três índices.
  Aplicar também `202610040008_framework_progress_goals` para os novos campos de metas.
  Não alternar o histórico de um banco existente. Não usar reset/db push.
- **Limitações:** não existe reconstrução histórica do catálogo/cobertura,
  versionamento de arquivos ou snapshot global entre transações de Workspaces.
  Atividades são uma projeção das entidades suportadas, não um feed completo
  de toda a auditoria. A API não divulga eventos pessoais de membros/identidade.
- **Verificação:** janelas UTC, >100 registros, totais completos, grants mistos,
  acesso revogado, fronteiras de tenant/projeto, metas sem recálculo,
  distribuição de enums e vazamento; resultados em
  [decisões](../codex/DASHBOARD_IMPLEMENTATION_DECISIONS.md).

## Inventário paginado de projetos — 08/10/2026

“Meus projetos” pode consumir [GET /api/v1/dashboard/projects](execution-imports-and-inventories.md#get-apiv1dashboardprojects),
sem limite do bloco projects da overview nem enumeração de contagens por
projeto. A overview permanece com os filtros, grants e limites deste guia.
