# Conclusão das metas por ações — 07/10/2026

Implementado na API v1 nas rotas existentes de Governança e na overview.
[Endpoints completos](governance.md), [contratos](governance-contracts.md),
[painel](dashboard.md) e [OpenAPI](openapi.json).

## Regra vigente

O atingimento da meta é independente de avaliações de framework e da métrica
lastResult. Todos os tipos de meta usam a mesma regra de conclusão:

- Ações válidas: vinculadas por goalId, no mesmo Workspace, status diferente de
  CANCELLED. OPEN/IN_PROGRESS contam no total; DONE conta como concluída.
- Percentual = 100 × concluídas / válidas, até duas casas; sem válidas: null.
  Enquanto houver pendência, limite 99,99 para não mostrar 100 por arredondamento.
- Ao menos uma válida e todas DONE: ACHIEVED, inclusive depois do prazo.
- Com pendência/sem ações válidas: MISSED se deadline < hoje UTC; ACTIVE caso contrário.
- Meta CANCELLED continua cancelada, mesmo com todas as ações DONE.
- Nova ação pendente reabre uma meta atingida. Cancelar uma pendência pode
  completar a meta se restar ao menos uma ação válida e todas estiverem DONE.
  Cancelar todas não produz atingimento.

Exemplo de uma entre três concluídas:

```json
{
  "basis": "ACTIONS",
  "totalActions": 3,
  "completedActions": 1,
  "cancelledActions": 0,
  "percent": 33.33
}
```

Esse é o objeto actionProgress, obrigatório nas respostas de Meta e em cada
item de data.governance da overview. O status retornado segue essa mesma base.

## Atualização e versões

POST actions, PATCH actions/{id} (vínculo/status) e POST actions/{id}/complete
atualizam a situação, version e updatedAt das metas afetadas não canceladas na
mesma transação da ação, com auditoria governance.goal.actions_updated.
Trocar o vínculo atualiza a origem e o destino; remover atualiza a origem.
Edição de título/descrição da ação sem status/vínculo não muda a meta.

A resposta dessas operações continua ActionPlanResponse. Após sucesso,
reconsultar ação, meta(s), listas filtradas por goalId e painéis. A version
antiga da meta pode passar a gerar 409 GOVERNANCE_VERSION_CONFLICT. Não enviar a
versão da ação em uma mutação da meta nem reutilizar a versão anterior da meta.

GET metas/listas/dashboard deriva totais/status atuais sem gravar ou auditar.
Isso atende também metas e ações existentes antes da entrega, sem backfill.
O banco legado pode conservar status antigo até uma escrita; a API sempre usa
os totais atuais para status, filtros, contagens e ordenação do painel.
GET não altera a version da meta. As consultas não recalculam lastResult.

## Fluxo do front

1. No detalhe da meta, exibir actionProgress.percent e seus totais. Mostrar
   null como “Sem ações válidas”; zero como “0%”. Exibir status da API.
2. Na overview, usar governance[].progress (igual a actionProgress.percent).
   Mostrar detail, atualizado para descrever a conclusão das ações.
3. Após criar/vincular/trocar/desvincular/cancelar/concluir ações, esperar o
   sucesso e reconsultar metas e painéis. Não precisa clicar “Calcular meta”
   para atualizar conclusão. Cancelar requisições do escopo anterior.
4. Separar a métrica informativa lastResult/currentValue/targetValue de
   “Conclusão das ações”. operator e targetValue não são o alvo desse círculo:
   o atingimento por ações exige 100% das válidas, qualquer que seja o critério.
   Se mantiver “Calcular meta”, rotular “Atualizar métrica informativa”.
5. Em 409, ler versões atuais antes de conciliar. Em rede/timeout, consultar
   o estado antes de repetir uma escrita. Preservar requestId nos erros.

A meta não é uma avaliação auditável do framework. Concluir ações não altera
controle, seção, framework, snapshot, índice ou frameworkGovernance. Esses
indicadores continuam exclusivamente baseados nas avaliações existentes.

## Acesso e compatibilidade

Mesmos grants governance.read/manage, Workspace ativo/membership e regras de
visibilidade de projeto/fontes já existentes. Agrupamento SQL por Workspace e
metas autorizadas, independente da paginação de ações. Sem rotas, grants,
colunas ou migrations novas; OpenAPI permanece com 179 operações.

Mudança de comportamento: status/progress/detail deixam de indicar o
atingimento da métrica e passam a medir conclusão de ações. DTOs de entrada,
lastResult e respostas de ações permanecem compatíveis; actionProgress é
adicional nas metas. Atualizar legendas do front para evitar interpretar
“sem avaliação encerrada” como ausência de progresso das ações.
