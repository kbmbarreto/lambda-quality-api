# Acompanhamento de frameworks e metas por seção

## Funcionalidade: progresso histórico de governança

- **Disponibilidade:** implementado, API v1, 04/10/2026.
- **Referência OpenAPI:** `getGovernanceFrameworkProgress`, `/docs-json` e [snapshot](openapi.json).
- **Resumo:** leitura da avaliação selecionada, índice ponderado, itens atendidos/avaliados e árvore completa do snapshot. Classificação continua no PUT existente.

## GET /api/v1/workspaces/{workspaceId}/governance/frameworks/{frameworkId}/progress

### Objetivo e acesso

Bearer/sessão válidos, membro ACTIVE em Workspace ACTIVE e `governance.read`
atual, inclusive por grupo. Framework vem da listagem existente; frameworks
arquivados continuam consultáveis. IDs tenant-scoped; escolha estrangeira
retorna 404 genérico. Leitura não cria/inicia/fecha avaliações nem gera auditoria.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer accessToken | Sim | Sessão atual |
| rota | workspaceId / frameworkId | UUID v4 | Sim | Mesmo tenant |
| query | assessmentId | UUID v4 | Não | Avaliação exata do framework, inclusive DRAFT |

Sem body, paginação, busca, ordenação ou outros filtros. Query desconhecida,
repetida, nula/vazia ou UUID inválido: 400.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/governance/frameworks/22222222-2222-4222-8222-222222222222/progress
Authorization: Bearer <accessToken>
```

Sem assessmentId: IN_PROGRESS mais recente por createdAt DESC, id ASC. Sem
IN_PROGRESS: CLOSED por closedAt DESC, id ASC. DRAFT não substitui fontes.
A mesma seleção é usada no `frameworkGovernance` do dashboard; days não a limita.

### Respostas de sucesso

HTTP 200; application/json, X-Request-Id e Cache-Control: no-store. Envelope
padrão, sem meta.pagination. Sem fonte elegível:

```json
{
  "data": {
    "generatedAt": "2026-10-04T09:00:00.000-03:00",
    "indicatorType": "INTERNAL",
    "state": "NO_ASSESSMENT",
    "framework": { "id": "22222222-2222-4222-8222-222222222222", "code": "QA", "name": "Qualidade", "version": 4 },
    "assessment": null,
    "definitionVersionDiffers": false,
    "summary": null,
    "sections": []
  },
  "message": "Progresso do framework consultado com sucesso.",
  "meta": { "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "timestamp": "2026-10-04T09:00:00.050-03:00" }
}
```

| Campo | Contrato |
| --- | --- |
| generatedAt | ISO com offset -03:00 de geração |
| indicatorType | INTERNAL; indicador interno, sem certificação automática |
| state | NO_ASSESSMENT, DRAFT, IN_PROGRESS, CLOSED |
| framework | id UUID, code/name atuais, version inteiro >=1 |
| assessment | null ou id/name/status/version da avaliação; definitionVersion do snapshot, assessmentDate YYYY-MM-DD, closedAt ISO com offset -03:00/null |
| definitionVersionDiffers | versão atual diferente da versão copiada; não quantifica alterações |
| summary | ProgressSummary/null; todos os controles da fonte uma vez |
| sections | até 500 seções do snapshot, inclusive vazias; sem paginação, position ASC/id ASC |

Cada seção: id, parentSectionId UUID/null, code, name, position, `direct` e
`subtree`, ambos ProgressSummary. direct conta só associação direta; subtree
inclui descendentes. Preservar a árvore histórica; não completar com catálogo atual.

#### ProgressSummary

| Campo | Contrato |
| --- | --- |
| state | EMPTY sem controles; NOT_APPLICABLE quando todos N/A; AVAILABLE nos demais casos |
| totalControls | inteiro >=0 |
| applicableControls | totalControls - counts.NOT_APPLICABLE |
| assessedControls | totalControls - counts.NOT_ASSESSED; inclui N/A |
| counts | todas as chaves NOT_ASSESSED, NOT_MET, PARTIALLY_MET, MET, NOT_APPLICABLE; inteiros >=0 |
| index | value número/null, numerator e denominator números >=0 |
| completionPercent | MET/applicableControls ×100; null sem aplicáveis |
| assessmentPercent | assessedControls/totalControls ×100; null sem controles |
| completed | ao menos um aplicável e todos os aplicáveis MET; nunca inferido do arredondamento |

Índice: soma(score × peso do snapshot)/soma(pesos aplicáveis). NOT_ASSESSED
contribui zero (score do item permanece null); NOT_MET=0, PARTIALLY_MET=50,
MET=100; NOT_APPLICABLE excluído. Percentuais/índice arredondados a duas casas.
EMPTY tem percentuais/índice null, completed false. Todos N/A: índice/conclusão
null, assessmentPercent 100, completed false. Seção vazia não está concluída.

Exemplo de summary para dois MET, um PARTIALLY_MET e um NOT_ASSESSED, peso 1:

```json
{
  "state": "AVAILABLE",
  "totalControls": 4,
  "applicableControls": 4,
  "assessedControls": 3,
  "counts": { "NOT_ASSESSED": 1, "NOT_MET": 0, "PARTIALLY_MET": 1, "MET": 2, "NOT_APPLICABLE": 0 },
  "index": { "value": 62.5, "numerator": 250, "denominator": 4 },
  "completionPercent": 50,
  "assessmentPercent": 75,
  "completed": false
}
```

Resumo independe dos filtros/páginas de GET assessment controls. Nunca tirar
média dos percentuais nem somar resumos de pais com filhos.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID/query inválido, extra ou repetido | Corrigir campo; preservar errors/requestId |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Identidade/sessão | Fluxo atual de autenticação |
| 403 | AUTH_FORBIDDEN | Grant ausente em Workspace visível | Revalidar acesso |
| 404 | RESOURCE_NOT_FOUND | Tenant/framework/avaliação inacessível ou não pertencente | Sem expor existência estrangeira |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | Infraestrutura | Preservar requestId; tentativa manual, sem substituir por zeros |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found", "title": "Recurso não encontrado", "status": 404,
  "detail": "Recurso não encontrado.", "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/governance/frameworks/22222222-2222-4222-8222-222222222222/progress",
  "code": "RESOURCE_NOT_FOUND", "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "timestamp": "2026-10-04T09:00:00.050-03:00"
}
```

### Fluxo de integração

1. Estrutura continua nas rotas de catálogo. Acompanhamento carrega progress
   e controles paginados da assessment.id retornada. Mostrar fonte/estado.
2. Sem avaliação: oferecer criar/iniciar explicitamente. DRAFT/IN_PROGRESS
   exibem índice provisório; CLOSED somente leitura.
3. Marcação rápida: PUT assessment controls/{controlId da definição}, com
   version atual e status MET. Exige governance.assess; só IN_PROGRESS.
   N/A exige justificativa; 409 recarrega versão/controles/progresso.
4. Após escrita, invalidar progress e overview. Filtros da tabela não mudam resumo.
5. Clique no cartão do Início passa Workspace/framework/assessmentId da fonte.
   Cancelar consultas ao mudar escopo/sessão; não fazer polling nem escritas em GET.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** nova leitura aditiva. Definição de controle não recebe completed/percentual manual.
- **Impacto:** novo DTO e bloco aditivo no [dashboard](dashboard.md). Mantém rotas de classificação.
- **Migração:** `202610040008_framework_progress_goals` afeta metas; progresso usa snapshots existentes.
- **Limitação:** uma avaliação por framework na fonte padrão, sem mistura histórica.
- **Verificação:** regras de árvore/pesos/nulos/arredondamento, seleção SQL, tenant/grants, snapshots e GET sem escrita em testes unitários/integração.

## Extensão dos endpoints de metas existentes

Aplica-se a POST goals, PATCH goals/{id}, GET goals, GET goals/{id} e POST
goals/{id}/calculate, descritos individualmente em [governança](governance.md).

- Criação/edição aceitam sectionId e ownerMemberId UUID v4/null; ausentes na
  criação viram null. PATCH null remove associação; ausente preserva.
- sectionId exige GOVERNANCE_SCORE, frameworkId do mesmo Workspace/framework,
  projectId null. Cruzamento retorna 404; escopo/tipo inválido 400.
- Responsável precisa ser membro ACTIVE do Workspace na atribuição; não é
  createdBy. Leitura retorna ownerDisplayName público/null; nunca e-mail.
  Membro removido mantém ID histórico e nome null. Edição sem nova atribuição
  permite conservar esse responsável antigo.
- Respostas acrescentam sectionId, ownerMemberId, ownerDisplayName, sectionName
  (string/null) e sectionPath (array de {id,code,name}, raiz até seção).
- Cálculo usa última CLOSED por closedAt DESC/id ASC e subárvore do snapshot.
  Sem seção mantém cálculo do framework. targetValue 0..100; para atendimento
  integral usar GTE 100. lastResult.value é valor atual, não progresso relativo.
- lastResult acrescenta `section` opcional (id/name/path históricos ou null) e
  `reason` opcional: NO_CLOSED_ASSESSMENT, SECTION_NOT_IN_SNAPSHOT, EMPTY_SECTION,
  NO_APPLICABLE_CONTROLS. value null nunca vira zero; fonte CLOSED em sourceIds,
  ou [] sem CLOSED. Ausente no snapshot não usa fonte antiga/framework inteiro.
- Antes do cálculo, sectionName/sectionPath usam catálogo atual. Depois usam
  exclusivamente lastResult.section; ausência histórica retorna null/[].
- PATCH invalida lastResult e incrementa version. Desde 07/10/2026, status da
  meta deriva das ações/prazo, salvo CANCELLED explícito; não deriva do índice do
  framework. GET nunca recalcula a métrica ou grava dados. [Conclusão por ações](goal-action-completion.md).
- Metas antigas migram com sectionId/ownerMemberId null; nenhuma rota removida.

```http
POST /api/v1/workspaces/11111111-1111-4111-8111-111111111111/governance/goals
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Atender Level 2", "goalType": "GOVERNANCE_SCORE", "operator": "GTE", "targetValue": 100,
  "frameworkId": "22222222-2222-4222-8222-222222222222", "projectId": null,
  "sectionId": "33333333-3333-4333-8333-333333333333", "ownerMemberId": null,
  "deadline": "2026-12-31"
}
```

Metas e ações não alteram o índice ou a conclusão dos controles/seções/framework.
O acompanhamento continua baseado exclusivamente nas avaliações e seus snapshots.
