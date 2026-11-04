# Use Cases

## Convenção

Writes usam Use Cases pequenos, input/output próprios, transação
explícita e autorização antes da mutação. Queries podem usar
projections/query services.

## Identity e sessões

RequestRegistrationCode; RegisterVerifiedUser; AuthenticateUser;
RefreshSession; LogoutSession; LogoutAllSessions; GetCurrentUser;
RequestPasswordResetCode; ResetPasswordWithCode. Cadastro e recuperação
foram autorizados em 30/09/2026; suspensão de usuário invalida o acesso
às sessões. Cadastro cria a identidade global e não cria Workspace.

Solicitação de código gera EmailChallenge, aplica cooldown por e-mail e
finalidade e envia o código via SendGrid. Confirmação cria User após código
válido; redefinição altera o hash da senha e revoga sessões atomicamente.
Falhas de confirmação preservam o contador de tentativas antes do erro HTTP.

AuthenticateUser valida senha/status, cria AuthSession e hash do refresh
token e emite JWT bearer. RefreshSession consome um token uma única vez e
insere o sucessor em transação; reuso revoga a família com commit antes do
erro HTTP. Logout usa a sessão do JWT validado e só opera sobre o usuário
autenticado. GetCurrentUser retorna DTO público, nunca hash ou credenciais.

As durações, claims e casos de concorrência seguem SECURITY_AND_TENANCY.md.
Casos de uso devolvem outputs próprios; a camada HTTP aplica os contratos
de API_SPEC.md. Permissões não são congeladas em claims do JWT.

## Workspace

Entregues em 02/10/2026: criar/listar/consultar/alterar Workspace; transferir
ownership; listar/consultar/suspender/reativar/remover membership;
criar/listar/consultar/reenviar/cancelar/aceitar convite; catálogo de permissions;
CRUD de roles customizadas e grupos; atribuir/revogar roles diretas e coletivas;
listar/adicionar/remover participantes; administrar/arquivar campos, administrar
tags e biblioteca privada de anexos (upload/metadados/download/exclusão).

Regras: normalizar e-mail; armazenar hash do token de convite; expiração
obrigatória; proibir relações cross-tenant.
Criação de Workspace inicializa Owner e roles Administrator/Member atomicamente.
Transferência exclusiva do Owner para membro ativo do mesmo tenant. Escopo e
permissions resolvidos com lock do tenant dentro da transação. Atribuições não
excedem o ator; remoção preserva identidade, limpa grants e exige novo convite
para reentrada. Aceite concorrente cria um único vínculo/grant/evento.
Intenção de envio cifrada é durável, com retries e reenvio que invalida token
anterior. Falha de banco em upload compensa o storage; exclusão é lógica e
limpeza física usa retenção. Valores de campos e vínculos a recursos futuros
acompanham seus consumidores, conforme decisões e contratos da Fase 01.

## Project

CreateProject; UpdateProject; ArchiveProject; AddProjectMember;
RemoveProjectMember; CreateMilestone; UpdateMilestone;
CompleteMilestone; CreateEnvironment; UpdateEnvironment.

Entregues na Fase 02 com listagens/consultas e exclusão lógica de marcos e
ambientes; atribuição local por PUT idempotente, roles VIEWER/EDITOR/MANAGER.
Autorização combina permissions do Workspace e capability local atual;
manage_all permite acesso administrativo sem vínculo. Archive preserva registros,
bloqueia mutações e mantém primeira data. Complete mantém completedAt sob
concorrência; CANCELLED não conclui e COMPLETED não é reescrito. Calendário
valida dias reais e intervalo. Environment excluído reserva nome e fica inativo.
Concessões e recursos são tenant/project-scoped, com auditoria transacional.

## Suite

Entregue na Fase 03 com listagens, consulta, move, reorder e archive.
Archive exige ausência de filhos/casos ativos; preserva registros.

CreateSuite; RenameSuite; MoveSuite; ReorderSuite; ArchiveSuite.
`MoveSuite` detecta ciclos.

## TestCase

Entregue na Fase 03, incluindo valores personalizados e vínculos de anexos.
AutomationStatus usa PATCH de caso; mutações do agregado exigem version.
[Contratos](../front-specs/test-case-contracts.md).

CreateTestCase; UpdateTestCase; MoveTestCase; CloneTestCase;
ArchiveTestCase; RestoreTestCase; AddTestStep; UpdateTestStep;
RemoveTestStep; ReorderTestSteps; AddTag; RemoveTag;
ChangeAutomationStatus.

Regras: Project obrigatório; Suite deve ser do mesmo Project/Workspace;
sequence imutável; arquivar não destrói Runs históricos.

## TestPlan

Entregue na Fase 04: listar/consultar plano e seleção, criar/editar plano,
adicionar/remover/ordenar seleção, ativar, concluir e arquivar plano.
[Contratos](../front-specs/execution-contracts.md).

## TestRun

CreateTestRunFromPlan; CreateAdHocTestRun; StartTestRun;
RecordCaseResult; RecordStepResult; AddExecutionComment;
CompleteTestRun; AbortTestRun.

Entregue na Fase 04, incluindo consultas paginadas de Runs/casos/comentários
e detalhe de caso com passos. Ao criar Run, copiar snapshots de definição,
passos, campos/valores, tags e contexto na mesma transação. Resultados
exigem IN_PROGRESS e version; terminal é imutável.

## Requirement

CreateRequirement; UpdateRequirement; ArchiveRequirement; LinkTestCase;
UnlinkTestCase; GetTraceabilityMatrix.

## Defect

Entregue na Fase 05: listar/consultar/criar defeito, criar de FAILED,
PATCH de metadados/estado com version, adicionar/remover referência externa e
vínculos de anexos. Origem não cruza Project/Workspace; execução permanece igual.
[Contratos](../front-specs/defect-contracts.md).

## Governance — Fase 06 entregue

CreateFramework; UpdateFramework; CreateSection; MoveSection;
CreateControl; UpdateControl; CreateAssessment; AssessControl;
AddEvidence; RemoveEvidence; CloseAssessment; CreateGovernanceGoal;
UpdateGoal; CalculateGoal; CreateActionPlan; CompleteActionPlan.

### Strategy para metas

```typescript
export interface GoalCalculator {
  supports(): GoalType;
  calculate(goal: GovernanceGoal, context: GoalCalculationContext): Promise<GoalResult>;
}
```

Implementações disponíveis: AutomationCoverageCalculator, GovernanceScoreCalculator
e CriticalDefectsCalculator. RequirementCoverageCalculator e FlakyTestRateCalculator
permanecem planejados; não são expostos em GET metrics nem aceitos nos DTOs.
Leitura usa portas públicas dos módulos fonte e valida acesso atual a todos os
Projetos do cálculo; persistência do resultado/status e audit é transacional.
Contratos adicionais: StartAssessment, ListEvidence, CancelGoal, UpdateActionPlan,
CancelActionPlan e GovernanceDashboard, conforme [decisões](GOVERNANCE_IMPLEMENTATION_DECISIONS.md).

## Attachments/Audit

UploadAttachment; LinkAttachment; UnlinkAttachment; DeleteAttachment.

Use cases relevantes persistem AuditEvent junto à mutação bem-sucedida
na mesma transação, ou usam outbox transacional quando a publicação for
assíncrona. Não perder auditoria por publicar somente depois do commit.
Eventos de revogação por reuso são persistidos mesmo quando a resposta é 401. Nunca registrar senha, token ou segredo no metadata.

## Visão geral do produto — entregue em 04/10/2026

GetDashboardOverview: query consolidada autorizada por fonte, sobre projetos
e Workspaces ativos, com janela UTC e comparação disponível. Metas são lidas
pelo último resultado, sem chamar CalculateGoal. [Contrato](../front-specs/dashboard.md)
e [decisões](DASHBOARD_IMPLEMENTATION_DECISIONS.md).

## Extensões autorizadas — 04/10/2026

Acompanhamento: consultar árvore do snapshot e três medidas distintas por avaliação, com fonte padrão compartilhada na overview. Metas por seção usam exclusivamente última CLOSED; ausência de base retorna null/motivo. Atribuição opcional a membro ativo do tenant; GET não calcula.

Defeitos: associar ambiente ativo ou herdar ambiente histórico da execução, com remoção explícita/null e versionamento. Administrar ambientes por projeto e categoria. Relatórios agregam a coorte por data de criação UTC e situação atual, respeitando escopo atual de acesso. Contratos em front-specs/framework-progress.md e front-specs/defect-analytics.md.
