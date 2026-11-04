# Entities

Em 02/10/2026 estão implementados Identity/Workspace, o catálogo de
CustomFieldDefinition/Tag e a biblioteca Attachment; Project/ProjectMember,
Milestone/Environment foram implementados na Fase 02. TestSuite/TestCase/TestStep e valores/vínculos foram implementados na Fase 03.
Planos e Execuções foram implementados na Fase 04; Defeitos na Fase 05.
Governança entregue na Fase 06 em 03/10/2026; requisitos e integrações permanecem planejados.

## Workspace/Identity

- **User:** id, email (normalizado/único), displayName, passwordHash,
  status, emailVerifiedAt, passwordChangedAt, createdAt, updatedAt.
  passwordHash nunca é retornado pela API; User é criado após confirmar
  o código de cadastro recebido por e-mail.
- **EmailChallenge:** id, email, purpose (REGISTRATION/PASSWORD_RESET),
  codeHash (HMAC), attempts, eligible, createdAt, expiresAt, consumedAt?,
  revokedAt?. Global, anterior ao User no cadastro; API retorna somente
  challengeId e prazos, nunca código/hash/elegibilidade.
- **EmailCodeScope:** id (hash de e-mail/finalidade), lastRequestedAt?.
  Registro técnico global para serializar reenvios/cooldown no banco.
- **AuthSession:** id, userId, createdAt, expiresAt, lastUsedAt,
  revokedAt?, revokeReason?. Identidade global; uma sessão por login e
  uma família de refresh tokens por sessão. lastUsedAt é atualizado no
  login/refresh, não prolonga o limite absoluto de expiresAt.
- **RefreshToken:** id, sessionId, tokenHash, createdAt, expiresAt,
  consumedAt?, revokedAt?, replacedByTokenId?. Hash único; sucessor na
  mesma sessão; token opaco nunca persistido em texto puro.
- **Workspace:** id, name, slug (único global), status, ownerMemberId,
  createdAt, updatedAt. Owner aponta por FK composta ao membro do mesmo tenant.
  Nulo somente durante bootstrap transacional; API sempre termina com Owner.
- **WorkspaceMember:** id, workspaceId, userId, status, joinedAt.
  Unique `(workspaceId,userId)`.
- **Invitation:** id, workspaceId, email, tokenHash, status,
  expiresAt, invitedBy, acceptedBy?, acceptedAt?, createdAt, lastSentAt,
  deliveryStatus, deliveryAttempts, deliveryPayload?. Payload técnico cifrado;
  hash/payload não saem em DTOs. EXPIRED é derivado de expiresAt.
- **Role:** id, workspaceId, name, normalizedName, description, systemRole,
  createdAt. Administrator/Member imutáveis; Owner não é Role.
- **Permission:** id, code, description.
- **Group:** id, workspaceId, name, normalizedName, description,
  createdAt.
- Junções: RolePermission, MemberRole, GroupMember, GroupRole.
  Incluem workspaceId e não relacionam membros/roles/groups de tenants
  diferentes. Permission é global.

## Project

- **Project:** id, workspaceId, key, name, description, status,
  createdAt, updatedAt, archivedAt?. Unique `(workspaceId,key)`; key uppercase
  imutável. Archive preserva histórico e bloqueia mutações.
- **ProjectMember:** id, workspaceId, projectId, workspaceMemberId,
  projectRole (VIEWER/EDITOR/MANAGER), createdAt, updatedAt.
  Unique `(workspaceId,projectId,workspaceMemberId)`; FKs compostas.
- **Milestone:** id, workspaceId, projectId, name, description,
  status, startDate?, dueDate?, completedAt?, createdAt, updatedAt, deletedAt?.
  Datas de calendário YYYY-MM-DD. Concluído não pode ser reescrito.
- **Environment:** id, workspaceId, projectId, name, description,
  normalizedName, active, createdAt, updatedAt, deletedAt?. Nome normalizado
  único por Project/Workspace, reservado após exclusão lógica.

## Test Management

- **CustomFieldDefinition (entregue):** id, workspaceId, key, name,
  description, target (TEST_CASE), type, required, position, options
  `{id,label}[]`, archivedAt?, createdAt, updatedAt. Unique `(workspaceId,target,key)`.
  archivedAt nulo indica ativo; o filtro HTTP status usa ACTIVE/ARCHIVED/ALL.
  Tipo/chave/alvo/opções imutáveis; archive preserva a chave. Valores futuros.

- **TestSuite:** id, workspaceId, projectId, parentSuiteId?, name,
  description, position, createdAt, updatedAt, archivedAt?.
- **TestCase:** id, workspaceId, projectId, suiteId?, sequence, title,
  description, preconditions, postconditions, severity, priority,
  status, type, layer, behavior, automationStatus, createdBy,
  version, timestamps, archivedAt?.
- **TestStep:** id, workspaceId, projectId, testCaseId, position, action,
  testData, expectedResult.
- **Tag (entregue):** id, workspaceId, name, normalizedName, createdAt,
  updatedAt. Nome único normalizado no Workspace; sem projectId nesta fase.
- **TestCaseTag:** id, workspaceId, projectId, testCaseId, tagId.
- **TestCaseAttachment:** id, workspaceId, projectId, testCaseId, attachmentId.
- **TestCaseFieldValue:** id, workspaceId, projectId, testCaseId, fieldId, value
  (JSON escalar).
- **SequenceCounter:** id, workspaceId, projectId, entityType TEST_CASE/DEFECT, nextValue.

Regras de valores, ordenação e histórico em
[decisões da Fase 03](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).

## Execution — Fase 04 entregue

- **TestPlan:** id, workspaceId, projectId, milestoneId?, environmentId?, name,
  description?, status, version, createdBy, createdAt, updatedAt,
  activatedAt?, completedAt?, archivedAt?.
- **TestPlanCase:** id, workspaceId, projectId, testPlanId, testCaseId, position.
- **TestRun:** id, workspaceId, projectId, testPlanId?, milestoneId?, environmentId?,
  name, source MANUAL, externalRunRef null, status, version, createdBy,
  createdAt, updatedAt, startedAt?, finishedAt?, planNameSnapshot?,
  milestoneSnapshot?, environmentSnapshot?. Summary é calculado na consulta.
- **TestRunCase:** id, workspaceId, projectId, testRunId, testCaseId, position,
  caseSequenceSnapshot, humanIdSnapshot, titleSnapshot, severitySnapshot,
  prioritySnapshot, definitionSnapshot, customFieldsSnapshot, tagsSnapshot,
  result, executedBy?, executedAt?, comment?, createdAt, updatedAt.
- **TestRunStep:** id, workspaceId, projectId, testRunId, testRunCaseId,
  sourceStepId (informativo sem FK), position, actionSnapshot,
  testDataSnapshot?, expectedResultSnapshot?, actualResult?, result, comment?,
  executedBy?, executedAt?.
- **ExecutionComment:** id, workspaceId, projectId, testRunId, runCaseId?,
  runStepId?, text, createdBy, createdAt; imutável, passo exige caso.

Snapshots incluem versão e toda definição do caso; campos incluem definições,
options, obrigatoriedade e valores; contexto copia nome/descrição de marco/ambiente.
[Contratos completos](../front-specs/execution-contracts.md) e
[decisões](EXECUTION_IMPLEMENTATION_DECISIONS.md).

## Requirement/Defect

- **Requirement:** id, workspaceId, projectId, sequence, title,
  description, status, externalRef?, timestamps.
- **RequirementTestCase:** workspaceId, requirementId, testCaseId.
- **Defect (Fase 05 entregue):** id, workspaceId, projectId, sequence, title,
  description?, severity, status, testRunCaseId?, externalSystem?, externalIssueId?,
  externalUrl?, version, createdBy, createdAt, updatedAt. humanId/testRunId são
  derivados; origem imutável, estados editáveis com version/auditoria.
- **DefectAttachment (entregue):** id, workspaceId, projectId, defectId,
  attachmentId; FKs compostas, somente vínculo, arquivos privados do tenant.
  [Contratos](../front-specs/defect-contracts.md). Requisitos continuam planejados.

## Attachments

- **Attachment (entregue):** id, workspaceId, storageKey,
  originalName, contentType, sizeBytes, checksum, uploadedBy,
  createdAt, deletedAt?.
  storageKey privado não é retornado. projectId e AttachmentLink genérico são
  futuros; TestCaseAttachment/DefectAttachment são associações tipadas entregues
  nas Fases 03/05.
- **AttachmentLink:** id, workspaceId, attachmentId, targetType,
  targetId.

## Governance — Fase 06 entregue

Área funcional do Workspace, com três grants próprios. Contratos completos em
[front-specs](../front-specs/governance-contracts.md) e [decisões](GOVERNANCE_IMPLEMENTATION_DECISIONS.md).

- **GovernanceFramework:** id, workspaceId, code, name, versionLabel,
  description?, status, version, createdAt, updatedAt.
- **FrameworkSection:** id, workspaceId, frameworkId, parentSectionId?,
  code, name, description?, position. Árvore sem ciclo, no máximo 20 níveis.
- **GovernanceControl:** id, workspaceId, frameworkId, sectionId, code,
  title, description?, weight (inteiro positivo, padrão 1), active.
- **Assessment:** id, workspaceId, frameworkId, name, status, assessmentDate,
  frameworkSnapshot, closedAt?, createdBy, version, createdAt, updatedAt.
  Copia definição na criação; CLOSED é imutável. GET acrescenta index derivado
  (value?, numerator, denominator, assessedControls, totalControls) e indicatorType=INTERNAL.
- **ControlAssessment:** id, workspaceId, frameworkId, assessmentId, controlId,
  controlSnapshot, status, score?, justification?, assessedBy?, assessedAt?.
  Snapshot contém definição, peso e sectionPath. N/A exige justificativa.
- **EvidenceLink:** id, workspaceId, controlAssessmentId, evidenceType,
  referenceId?, url?, title, validUntil?, attachmentSnapshot?, createdBy, createdAt.
  ATTACHMENT/URL exclusivos; referenceId é FK tenant-scoped ao arquivo privado.
  GET acrescenta attachmentAvailable derivado. Snapshot não inclui storageKey.
- **GovernanceGoal:** id, workspaceId, projectId?, frameworkId?, name,
  description?, goalType, operator, targetValue, deadline?, status,
  lastResult?, createdBy, version, createdAt, updatedAt. Result inclui value?,
  numerator?, denominator?, calculatedAt e sourceIds. Strategy apenas para
  AUTOMATION_COVERAGE, CRITICAL_DEFECTS e GOVERNANCE_SCORE nesta fase.
- **ActionPlan:** id, workspaceId, controlAssessmentId?, goalId?, title,
  description?, ownerMemberId?, status, dueDate?, completedAt?, createdBy,
  version, createdAt, updatedAt. Vínculos imutáveis; remediação independente
  da imutabilidade da avaliação.

Score interno ponderado: NOT_MET=0, PARTIALLY_MET=50, MET=100; N/A excluído;
sem aplicáveis retorna null, sem classificação bloqueia fechar. O cálculo
não é certificação oficial. Datas YYYY-MM-DD reais, timestamps UTC.

## Audit

**AuditEvent:** id, workspaceId?, actorUserId?, action, entityType,
entityId, projectId?, occurredAt, correlationId, metadataJson. Imutável.
Na entrega inicial de identidade são persistidos os campos de identificação,
ator, ação, entidade e correlação; projectId/metadataJson serão acrescentados
com a ampliação da auditoria de negócio.
Workspace é obrigatório para eventos tenant-scoped e nulo somente para
eventos globais de identidade; correlationId corresponde a requestId HTTP
quando a ação nasceu de uma requisição. metadataJson não contém segredos.

## Convenções transversais

- Timestamps em UTC; UUID para IDs técnicos; campos/identificadores em inglês.
- Adicionar projectId em filhos/junções conforme necessário para validar
  relações do mesmo projeto por FK composta, como descrito em DATABASE_MODEL.md.
- DTOs públicos omitem passwordHash, tokenHash e metadados privados de sessão.
- version pode ser adicionado para controle otimista em agregados concorrentes.

## Enums

```text
UserStatus ACTIVE SUSPENDED
WorkspaceStatus ACTIVE SUSPENDED ARCHIVED
MemberStatus ACTIVE SUSPENDED REMOVED
InvitationStatus PENDING ACCEPTED CANCELED (EXPIRED derivado no DTO)
DeliveryStatus PENDING SENT FAILED
CustomFieldType TEXT NUMBER BOOLEAN DATE SINGLE_SELECT
CustomFieldStatus ACTIVE ARCHIVED
ProjectStatus ACTIVE ARCHIVED
MilestoneStatus PLANNED IN_PROGRESS COMPLETED CANCELLED
Severity TRIVIAL MINOR NORMAL MAJOR CRITICAL BLOCKER
Priority LOW MEDIUM HIGH URGENT
TestCaseStatus DRAFT ACTIVE DEPRECATED ARCHIVED
TestType FUNCTIONAL REGRESSION SMOKE SANITY PERFORMANCE SECURITY USABILITY OTHER
TestLayer E2E API INTEGRATION UNIT COMPONENT OTHER
AutomationStatus MANUAL TO_BE_AUTOMATED IN_PROGRESS AUTOMATED NOT_APPLICABLE
PlanStatus DRAFT ACTIVE COMPLETED ARCHIVED
RunStatus CREATED IN_PROGRESS COMPLETED ABORTED
TestResult NOT_TESTED PASSED FAILED BLOCKED SKIPPED
RunSource MANUAL (API AZURE_DEVOPS JENKINS GITHUB_ACTIONS OTHER são futuros)
RequirementStatus DRAFT ACTIVE DONE ARCHIVED
DefectStatus OPEN IN_PROGRESS RESOLVED CLOSED REJECTED
FrameworkStatus DRAFT ACTIVE ARCHIVED
AssessmentStatus DRAFT IN_PROGRESS CLOSED
ComplianceStatus NOT_ASSESSED NOT_MET PARTIALLY_MET MET NOT_APPLICABLE
GoalType AUTOMATION_COVERAGE CRITICAL_DEFECTS GOVERNANCE_SCORE
GoalOperator GT GTE EQ LTE LT
EvidenceType ATTACHMENT URL
GoalStatus ACTIVE ACHIEVED MISSED CANCELLED
ActionPlanStatus OPEN IN_PROGRESS DONE CANCELLED
```

## Extensões entregues em 04/10/2026

Environment acrescenta category PRODUCTION/HOMOLOGATION/OTHER (padrão OTHER). Defect acrescenta environmentId? e environmentSnapshot? {name,category}, com FK composta de Workspace/projeto e cópia na associação. Governança: GovernanceGoal acrescenta sectionId? e ownerMemberId?, com FKs compostas tenant-scoped. GoalResult JSON acrescenta reason? e section? {id,name,path} históricos; leitura apresenta sectionName/sectionPath/ownerDisplayName públicos. FrameworkProgress é uma projeção derivada da avaliação, sem nova entidade/tabela nem completed manual em controle.

## Evoluções de 06/10/2026

- GovernanceControl: creationOrder inteiro técnico imutável, gerado pelo banco.
- TestCaseImport: id/workspaceId/projectId/fileHash, cases (recibo JSON), createdBy/createdAt;
  unique Workspace/projeto/hash, sem execução de conteúdo CSV.
- TestVaultEntry: id/workspaceId/projectId/environmentId?, name, encryptedPayload,
  keyId, version, createdBy/createdAt/updatedAt/deletedAt?. Dados sensíveis somente
  em ciphertext; chave externa e campos de retorno explícitos.
