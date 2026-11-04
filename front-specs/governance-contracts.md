# Contratos e integração de Governança

Fase 06 implementada em 03/10/2026, API v1. [33 endpoints](governance.md),
[OpenAPI](openapi.json) e [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md).
Base `/api/v1/workspaces/{workspaceId}/governance`. O indicador é **INTERNAL**,
sem afirmação de certificação ou conformidade oficial.

## Acesso e compatibilidade

Sessão bearer, membership ACTIVE e grants do banco revalidados em cada operação.
Owner/Administrator têm governance.read/assess/manage; Member recebe read. Roles
customizadas mantêm seus grants e podem receber os novos códigos explicitamente.
Catálogo passa de 29 para 32 permissions: WorkspaceResponse.permissions e
Role.permissionCodes podem conter esses códigos. Matriz local de Projeto não muda.

read consulta; assess cria/inicia/avalia/fecha e gerencia evidências; manage
cria/edita definições, metas e ações. Nenhum grant implica automaticamente outro.
Meta de Projeto e ação vinculada exigem visibilidade atual do Projeto; cálculo
exige testcase.read ou defect.read conforme fonte. Projeto ARCHIVED permite leitura
e bloqueia alterações/cálculo. Meta de Workspace de automação/defeitos exige acesso
a TODOS os Projetos ACTIVE com leitura da fonte; falha 403 se falta acesso. Leitura
histórica também verifica os Projetos sourceIds; listas/dashboard ocultam metas
e ações sem esse acesso antes da contagem. Nenhum cálculo usa amostra dos visíveis.

Aplicar migration `202610030006_governance` antes de iniciar a nova API. É aditiva;
preserva definições, execuções, defeitos, anexos e grants customizados. Endpoints
anteriores mantêm contratos; catálogo/Owner/Administrator/Member são ampliados.
Migration não aplicada automaticamente ao banco configurado nesta entrega.

## Definições, árvore e concorrência

Framework DRAFT → ACTIVE → ARCHIVED, podendo arquivar DRAFT diretamente. ARCHIVED
terminal. ACTIVE exige ao menos um controle ativo; seu último controle não pode
ser desativado. Definições podem mudar em DRAFT/ACTIVE sem alterar avaliações.
code ASCII maiúsculo `[A-Z0-9_.-]`, 1–50, único no Workspace para framework e no
framework para seção/controle; collation do banco trata equivalentes sem diferença
por case. name 1–100; versionLabel 1–50; title 1–250, com trim. description e
justification até 10000, aceitam null e preservam texto. Ausente mantém no PATCH;
null somente onde nullable. Campos extras, enums inexistentes e tipos errados falham.

Seção: parentSectionId opcional/nulo, posição explícita 1–1000000. PATCH altera
parent/position para mover/ordenar. Até 20 níveis, sem ciclo inclusive descendentes;
500 seções/1000 controles por framework. Posições repetidas permitidas com desempate
por UUID. Controle: sectionId do framework, weight inteiro 1–1000 (padrão 1),
active boolean (padrão true). Não há exclusão física; desativar controle preserva
histórico. Definições consultadas em listas; não há GET individual de seção/controle.

Framework/Assessment/Goal/ActionPlan iniciam version=1, usam inteiro até 2147483647.
Toda escrita posterior exige version atual e incrementa agregado/updatedAt junto
a audit. Criar/editar seção/controle exige versão do Framework e retorna
`{section|control,frameworkVersion}`. Toda mudança de resultado/evidência retorna
Assessment atualizado. Não há chave idempotente ou no-op garantido nesta fase.
409 GOVERNANCE_VERSION_CONFLICT exige consultar agregado, conciliar e reenviar.

## Avaliações e índice interno

Criação exige framework ACTIVE, copia imediatamente metadata/árvore/controles ativos.
Snapshot inclui peso e caminho da seção. Cada avaliação tem seus resultados
independentes. DRAFT → IN_PROGRESS pelo start; somente em andamento aceita resultados
ou evidências. Fechar exige todos classificados e justificativa não vazia para N/A.
CLOSED é terminal, sem reabertura, edição ou exclusão. Mudanças de definição não
alteram snapshot; ações vinculadas podem evoluir independentemente.

PUT de controle usa ID da definição controlId obtido em ControlAssessment; não usar
id de ControlAssessment na rota. NOT_ASSESSED limpa assessedBy/assessedAt; score
é derivado: NOT_MET=0, PARTIALLY_MET=50, MET=100, demais null. N/A requer justification
na própria requisição. NOT_ASSESSED admite limpar resultado antes do fechamento.

Índice = soma(score × weight) / soma(weight aplicável), duas casas decimais.
NOT_ASSESSED contribui zero na prévia e bloqueia fechamento; N/A excluído.
Todos N/A → value=null; denominator=0. `index` inclui numerator, denominator,
assessedControls, totalControls. Datas da avaliação são calendárias, não timestamp.

## Evidências privadas

ATTACHMENT exige referenceId de anexo disponível no mesmo Workspace e url ausente/null.
URL exige url HTTP/HTTPS absoluta até 2048, sem credenciais, espaços, controles ou
backslash, com referenceId ausente/null. Sem acesso remoto, sincronização ou prova
de existência. Nunca renderizar URL como HTML; a API apenas registra a referência.
Inclusão ATTACHMENT exige attachment.read; listar evidências de um controle que tem
arquivo também exige attachment.read, mesmo quando filtrando por título de URL.
Remover vínculo exige assess, não apaga bytes. Até 100 links por controle.

attachmentSnapshot copia originalName/contentType/sizeBytes/checksum, sem storageKey.
Após exclusão lógica, snapshot permanece e attachmentAvailable=false; URL tem null.
Download/metadata atual mantém authorization da [biblioteca](workspace-attachments.md).
validUntil é opcional/nulo; expiração produz atenção no dashboard, não reclassifica
nem impede fechar avaliação. CLOSED preserva evidências, exceto disponibilidade
atual do arquivo derivada no GET. Links novos não aceitam arquivo excluído.

## Metas e estratégias de cálculo

GET metrics retorna somente três goalTypes disponíveis. Requisitos, flaky,
regressão e revisões não são apresentados como metas implementadas.

| goalType | Escopo | Fonte e regras |
| --- | --- | --- |
| AUTOMATION_COVERAGE | Projeto ou todos os Projetos ACTIVE do Workspace | Casos ACTIVE; AUTOMATED / todos os ativos × 100. DRAFT/ARCHIVED excluídos; denominador zero → null. |
| CRITICAL_DEFECTS | Projeto ou todos os Projetos ACTIVE do Workspace | Contagem CRITICAL/BLOCKER em OPEN/IN_PROGRESS. RESOLVED/CLOSED/REJECTED excluídos; vazio → 0. |
| GOVERNANCE_SCORE | Workspace, frameworkId obrigatório, projectId nulo | Última Assessment CLOSED do framework por closedAt desc, UUID asc em empate. Sem avaliação/todos N/A → null. |

operator GT/GTE/EQ/LTE/LT; targetValue finito, duas casas, 0–100 para percentuais e
inteiro 0–1000000000 para contagem. frameworkId é nulo nas outras métricas.
projectId/frameworkId/goalType podem mudar por PATCH se a combinação final é válida
e o acesso ao escopo antigo e novo está autorizado. deadline real YYYY-MM-DD/nulo.

POST calculate calcula no servidor, grava lastResult {value,numerator,denominator,
calculatedAt,sourceIds}, version e status. Para score, numerator é soma(score×peso);
para cobertura, é quantidade de automatizados. sourceIds lista Projetos ou Assessment.
Desde 07/10/2026, lastResult é informativo e não determina se a meta foi atingida.
**Atingimento depende exclusivamente das ações vinculadas**: todas as ações válidas
em DONE e ao menos uma válida => ACHIEVED. CANCELLED não entra no denominador.
Com pendência/sem base: MISSED se deadline < hoje UTC; ACTIVE nos demais casos.
Meta CANCELLED permanece cancelada. Nova ação pendente reabre uma meta atingida.
Critério/operator/targetValue continuam descrevendo a métrica informativa, mas não
são usados no percentual de conclusão por ações nem no status.

GET/listas/dashboard agregam actionProgress atual sem gravar nem recalcular a
métrica. Metas existentes refletem ações já concluídas na primeira consulta,
sem migration/backfill. Cancelamento manual continua explícito e terminal.
POST calculate ainda calcula a métrica/lastResult, incrementa version e preserva
as regras de fonte; sua resposta usa o atingimento por ações. PATCH de metadados
limpa lastResult conforme antes, mas situação continua derivada das ações/prazo.
Exibir calculatedAt apenas junto à métrica, separado do progresso das ações.

## Ações e dashboard

Ação nasce OPEN. PATCH permite IN_PROGRESS ou CANCELLED; OPEN não retorna de
IN_PROGRESS. Complete muda para DONE e completedAt; DONE/CANCELLED são terminais.
controlAssessmentId/goalId são opcionais/nulos e podem coexistir. O vínculo
controlAssessmentId permanece imutável. Desde 07/10/2026, PATCH de ação OPEN ou
IN_PROGRESS aceita goalId: ausente mantém; UUID v4 associa/troca; null remove.
Uma ação pertence a no máximo uma meta; uma meta admite várias ações. Não existe
associação em lote. Usar version da ação, não da meta. O vínculo incrementa
version/updatedAt da ação e grava auditoria na mesma transação. Criar/vincular/
desvincular/trocar/cancelar/concluir ações atualiza automaticamente status,
version e updatedAt das metas afetadas não canceladas, com auditoria
`governance.goal.actions_updated`. Não recalcula lastResult nem modifica avaliações.

Exige governance.manage, acesso à ação atual e à meta de destino no mesmo
Workspace. O projeto da origem/destino, quando houver, deve estar ativo;
meta de Workspace mantém as verificações de fontes atuais e históricas.
Destino CANCELLED retorna 409 GOVERNANCE_GOAL_CANCELLED. ACHIEVED/MISSED podem
receber ações. Ação DONE/CANCELLED permanece imutável, inclusive o vínculo.
ownerMemberId deve ser membro ACTIVE do tenant, dueDate real/nulo. Uma ação de
remediação em Assessment CLOSED não edita resultado/evidência/version da avaliação.
Meta já vinculada CANCELLED não impede evoluir ou desvincular ações de melhoria;
projeto arquivado impede escrita, inclusive remoção/troca do vínculo.

Dashboard traz contagens de frameworks/avaliações, última CLOSED por framework e
contagens de metas/ações visíveis. attention conta controles NOT_MET/PARTIALLY_MET e
evidências vencidas somente nas últimas avaliações fechadas. Não inclui score oficial,
média geral entre frameworks, metas futuras ou fontes inacessíveis. Dados podem ficar
desatualizados entre chamadas; chaves de cache incluem Workspace e quando aplicável
Projeto/Framework/Assessment/Goal/ActionPlan. Revogação e troca de tenant limpam cache.

## Consulta, erros e fluxo

page=1 até 100000; size=20 até 100; q trim 1–100 com busca literal nos campos do endpoint.
sort `campo,asc|desc`, padrão asc, desempate UUID asc. Controle avaliado não aceita q;
seções não aceitam status. GET detalhe/metrics/dashboard não aceita query.
Listas vazias retornam data=[] e totalItems/totalPages=0, hasNext/hasPrevious=false.
JSON até 32 KiB, sem query em mutações. Headers X-Request-Id e Cache-Control:no-store;
criação 201 tem Location (coleção nas definições filhas). Erros Problem Details;
errors[].field/code/message para validação declarativa, podendo não existir em regra
semântica. Conservar requestId para diagnóstico; nunca depender da mensagem traduzida.

1. Consultar grants e listar/criar framework; criar árvore e controles com versão atual.
2. Ativar definição, criar avaliação e iniciar. Resultados/evidências alteram só versão
   da avaliação; mostrar snapshot e índice INTERNAL.
3. Fechar somente após todos classificados. Criar ações independentes para melhorias.
4. Consultar metrics, criar meta válida, calcular explicitamente e exibir instante/fonte.
5. Atualizar listas/dashboard após escritas. Serialize operações do mesmo agregado.

401 segue [autenticação](authentication.md); 403 recarrega grants, 404 atualiza contexto
sem confirmar existência em outro tenant; 409 reconsulta versão/estado. Desde 08/10/2026, governança autenticada
não tem quota geral de requisições. GET pode repetir com backoff. Timeout/rede de escrita exige confirmar
estado antes de repetir; criação repetida pode duplicar, códigos de definição únicos
podem resultar em RESOURCE_CONFLICT. Não repetir mutações cegamente após 5xx.

## DTOs e respostas

Inputs têm os limites documentados por endpoint e schemas explícitos do OpenAPI.
Todos os campos de resposta abaixo são obrigatórios, com null explícito onde indicado.
Date-time com offset -03:00 (persistência UTC), date calendária; score/índice/calculatedAt/ator vêm do servidor.

### ActionCountsResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| open | number | Ver regras de negócio no contrato. |
| inProgress | number | Ver regras de negócio no contrato. |
| done | number | Ver regras de negócio no contrato. |
| cancelled | number | Ver regras de negócio no contrato. |

### ActionPlanResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| controlAssessmentId | string / uuid ou null | aceita null |
| goalId | string / uuid ou null | aceita null |
| title | string | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| ownerMemberId | string / uuid ou null | aceita null |
| status | enum OPEN, IN_PROGRESS, DONE, CANCELLED | Ver regras de negócio no contrato. |
| dueDate | string / date ou null | aceita null; data real YYYY-MM-DD, 1000–9999 |
| completedAt | string / date-time ou null | aceita null |
| createdBy | string / uuid | Ver regras de negócio no contrato. |
| version | number | Ver regras de negócio no contrato. |
| createdAt | string / date-time | Ver regras de negócio no contrato. |
| updatedAt | string / date-time | Ver regras de negócio no contrato. |

### AssessmentCountsResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| draft | number | Ver regras de negócio no contrato. |
| inProgress | number | Ver regras de negócio no contrato. |
| closed | number | Ver regras de negócio no contrato. |

### AssessmentIndexResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| value | number ou null | aceita null |
| numerator | number | Ver regras de negócio no contrato. |
| denominator | number | Ver regras de negócio no contrato. |
| assessedControls | number | Ver regras de negócio no contrato. |
| totalControls | number | Ver regras de negócio no contrato. |

### AssessmentResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| frameworkId | string / uuid | Ver regras de negócio no contrato. |
| name | string | Ver regras de negócio no contrato. |
| status | enum DRAFT, IN_PROGRESS, CLOSED | Ver regras de negócio no contrato. |
| assessmentDate | string / date | data real YYYY-MM-DD, 1000–9999 |
| frameworkSnapshot | FrameworkSnapshotResponse | Ver regras de negócio no contrato. |
| closedAt | string / date-time ou null | aceita null |
| createdBy | string / uuid | Ver regras de negócio no contrato. |
| version | number | Ver regras de negócio no contrato. |
| createdAt | string / date-time | Ver regras de negócio no contrato. |
| updatedAt | string / date-time | Ver regras de negócio no contrato. |
| index | AssessmentIndexResponse | Ver regras de negócio no contrato. |
| indicatorType | enum INTERNAL | Ver regras de negócio no contrato. |

### AttachmentSnapshotResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| originalName | string | Ver regras de negócio no contrato. |
| contentType | string | Ver regras de negócio no contrato. |
| sizeBytes | number | Ver regras de negócio no contrato. |
| checksum | string | Ver regras de negócio no contrato. |

### AttentionResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| notMetControls | number | Ver regras de negócio no contrato. |
| partiallyMetControls | number | Ver regras de negócio no contrato. |
| expiredEvidence | number | Ver regras de negócio no contrato. |

### ControlAssessmentResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| frameworkId | string / uuid | Ver regras de negócio no contrato. |
| assessmentId | string / uuid | Ver regras de negócio no contrato. |
| controlId | string / uuid | Ver regras de negócio no contrato. |
| controlSnapshot | ControlSnapshotResponse | Ver regras de negócio no contrato. |
| status | enum NOT_ASSESSED, NOT_MET, PARTIALLY_MET, MET, NOT_APPLICABLE | Ver regras de negócio no contrato. |
| score | number ou null | aceita null |
| justification | string ou null | aceita null |
| assessedBy | string / uuid ou null | aceita null |
| assessedAt | string / date-time ou null | aceita null |

### ControlMutationResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| control | GovernanceControlResponse | creationOrder inteiro técnico imutável; Ver regras de negócio no contrato. |
| frameworkVersion | number | Ver regras de negócio no contrato. |

### ControlSnapshotResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| sectionId | string / uuid | Ver regras de negócio no contrato. |
| code | string | Ver regras de negócio no contrato. |
| title | string | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| weight | number | Ver regras de negócio no contrato. |
| sectionPath | array de SectionPathResponse | Ver regras de negócio no contrato. |

### DashboardResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| indicatorType | string | Ver regras de negócio no contrato. |
| frameworks | number | Ver regras de negócio no contrato. |
| assessments | AssessmentCountsResponse | Ver regras de negócio no contrato. |
| latestAssessments | array de LatestAssessmentResponse | Ver regras de negócio no contrato. |
| goals | GoalCountsResponse | Ver regras de negócio no contrato. |
| actions | ActionCountsResponse | Ver regras de negócio no contrato. |
| attention | AttentionResponse | Ver regras de negócio no contrato. |

### EvidenceLinkResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| controlAssessmentId | string / uuid | Ver regras de negócio no contrato. |
| evidenceType | enum ATTACHMENT, URL | Ver regras de negócio no contrato. |
| referenceId | string / uuid ou null | aceita null |
| url | string ou null | aceita null |
| title | string | Ver regras de negócio no contrato. |
| validUntil | string / date ou null | aceita null; data real YYYY-MM-DD, 1000–9999 |
| attachmentSnapshot | object ou null | aceita null |
| createdBy | string / uuid | Ver regras de negócio no contrato. |
| createdAt | string / date-time | Ver regras de negócio no contrato. |
| attachmentAvailable | boolean ou null | aceita null |

### FrameworkSectionResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| frameworkId | string / uuid | Ver regras de negócio no contrato. |
| parentSectionId | string / uuid ou null | aceita null |
| code | string | Ver regras de negócio no contrato. |
| name | string | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| position | number | Ver regras de negócio no contrato. |

### FrameworkSnapshotResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| code | string | Ver regras de negócio no contrato. |
| name | string | Ver regras de negócio no contrato. |
| versionLabel | string | Ver regras de negócio no contrato. |
| version | number | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| sections | array de FrameworkSectionResponse | Ver regras de negócio no contrato. |

### GoalCountsResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| active | number | Ver regras de negócio no contrato. |
| achieved | number | Ver regras de negócio no contrato. |
| missed | number | Ver regras de negócio no contrato. |
| cancelled | number | Ver regras de negócio no contrato. |

### GoalResultResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| value | number ou null | aceita null |
| numerator | number ou null | aceita null |
| denominator | number ou null | aceita null |
| calculatedAt | string / date-time | Ver regras de negócio no contrato. |
| sourceIds | array de string | Ver regras de negócio no contrato. |

### GovernanceControlResponse

creationOrder: inteiro positivo técnico, imutável, atribuído pelo banco. Ordenação
padrão da listagem é creationOrder crescente; code é o identificador do usuário.

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| creationOrder | inteiro positivo | Técnico, imutável, gerado pelo banco; ordenação padrão ascendente |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| frameworkId | string / uuid | Ver regras de negócio no contrato. |
| sectionId | string / uuid | Ver regras de negócio no contrato. |
| code | string | Ver regras de negócio no contrato. |
| title | string | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| weight | number | Ver regras de negócio no contrato. |
| active | boolean | Ver regras de negócio no contrato. |

### GovernanceFrameworkResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| code | string | Ver regras de negócio no contrato. |
| name | string | Ver regras de negócio no contrato. |
| versionLabel | string | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| status | enum DRAFT, ACTIVE, ARCHIVED | Ver regras de negócio no contrato. |
| version | number | Ver regras de negócio no contrato. |
| createdAt | string / date-time | Ver regras de negócio no contrato. |
| updatedAt | string / date-time | Ver regras de negócio no contrato. |

### GovernanceGoalResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| workspaceId | string / uuid | Ver regras de negócio no contrato. |
| projectId | string / uuid ou null | aceita null |
| frameworkId | string / uuid ou null | aceita null |
| name | string | Ver regras de negócio no contrato. |
| description | string ou null | aceita null |
| goalType | enum AUTOMATION_COVERAGE, CRITICAL_DEFECTS, GOVERNANCE_SCORE | Ver regras de negócio no contrato. |
| operator | enum GT, GTE, EQ, LTE, LT | Ver regras de negócio no contrato. |
| targetValue | number | Ver regras de negócio no contrato. |
| deadline | string / date ou null | aceita null; data real YYYY-MM-DD, 1000–9999 |
| status | enum ACTIVE, ACHIEVED, MISSED, CANCELLED | Ver regras de negócio no contrato. |
| lastResult | object ou null | Métrica informativa; não representa conclusão por ações. |
| actionProgress | GoalActionProgressResponse | Obrigatório; totais atuais das ações, descritos abaixo. |
| createdBy | string / uuid | Ver regras de negócio no contrato. |
| version | number | Ver regras de negócio no contrato. |
| createdAt | string / date-time | Ver regras de negócio no contrato. |
| updatedAt | string / date-time | Ver regras de negócio no contrato. |

### LatestAssessmentResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| frameworkId | string / uuid | Ver regras de negócio no contrato. |
| assessmentId | string / uuid | Ver regras de negócio no contrato. |
| frameworkName | string | Ver regras de negócio no contrato. |
| closedAt | string / date-time | Ver regras de negócio no contrato. |
| index | number ou null | aceita null |

### MetricsResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| goalTypes | array de string | Ver regras de negócio no contrato. |
| indicatorType | string | Ver regras de negócio no contrato. |

### SectionMutationResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| section | FrameworkSectionResponse | Ver regras de negócio no contrato. |
| frameworkVersion | number | Ver regras de negócio no contrato. |

### SectionPathResponse

| Campo | Tipo/formato | Regras |
| --- | --- | --- |
| id | string / uuid | Ver regras de negócio no contrato. |
| code | string | Ver regras de negócio no contrato. |
| name | string | Ver regras de negócio no contrato. |

## Verificação e limites

Lint, tipos e build aprovados; 110 testes passaram (43 unitários/HTTP, 67
com MySQL 8.4.11 real), incluindo banco vazio/upgrade da Fase 05, isolamento,
snapshots/fechamento, ciclos, metas, evidências e ações. Resultados constam nas [decisões](../codex/GOVERNANCE_IMPLEMENTATION_DECISIONS.md#validação-da-entrega).
URLs externas são referências manuais; caixa postal/storage externo e frameworks
oficiais pré-carregados não fazem parte da validação. Banco configurado não migrado.

## Acompanhamento e metas por seção — 04/10/2026

[Contrato entregue](framework-progress.md): leitura progress, fonte compartilhada no dashboard, sectionId/ownerMemberId e lastResult histórico. Nenhuma escrita em GET. Aplicar migration 202610040008_framework_progress_goals.

## GoalActionProgressResponse — 07/10/2026

| Campo | Tipo | Regra |
| --- | --- | --- |
| basis | enum ACTIONS | Base fixa da conclusão |
| totalActions | inteiro >=0 | Ações válidas vinculadas; exclui CANCELLED |
| completedActions | inteiro >=0 | Ações DONE na mesma base |
| cancelledActions | inteiro >=0 | Canceladas vinculadas, para informação |
| percent | número 0–100 ou null | 100 × completedActions / totalActions; vazio null |

Arredonda até duas casas; limita a 99,99 enquanto existir pendência, evitando
100 por arredondamento. Não depende da paginação, período, operator, targetValue
ou avaliações. Continua restrito ao Workspace/meta atualmente autorizados.
