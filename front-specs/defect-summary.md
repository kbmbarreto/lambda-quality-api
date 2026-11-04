# Indicadores do inventário consolidado de defeitos

## Funcionalidade: resumo de todo o histórico autorizado

- **Disponibilidade:** implementado, API v1, 08/10/2026.
- **Referência OpenAPI:** `getDefectInventorySummary`, `/docs-json` e [snapshot](openapi.json).
- **Resumo:** cartões e distribuições da tela global de Defeitos, sem ler todas as páginas. Tempo de correção confirmado pelo produto: **criação até resolução**.

## GET /api/v1/defects/summary

### Objetivo e acesso

Bearer, sessão/membership/grants atuais, Workspaces ativos e `defect.read`
efetivo em projetos visíveis. Inclui projetos arquivados autorizados e todo o
histórico; não aplica janela de 36 meses. Autoriza as fontes antes de filtrar e
agregar; não expõe IDs, nomes ou quantidades de fontes ocultas. Não exige grant
global novo. Usa a mesma transação e os mesmos bloqueios de autorização do
[inventário](product-improvements.md#tela-de-defeitos).

workspaceId vem da lista de Workspaces; projectId vem dos projetos autorizados.
Ambos são opcionais. Sem escopo, nenhuma fonte autorizada resulta em zeros.
Workspace informado sem membership/permissão `defect.read`, projeto informado
invisível/sem acesso, escopo inexistente ou projeto de outro Workspace: 404.
Workspace autorizado sem projetos visíveis pode retornar zeros.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer access token | sim | Mesmo token da listagem. |
| query | workspaceId | UUID v4 | não | Restringe Workspace autorizado ativo. |
| query | projectId | UUID v4 | não | Restringe projeto autorizado, inclusive arquivado; compatível com workspaceId. |
| query | q | string | não | Trim, 1–100 caracteres; busca em title, mesma collation da listagem. `%` e `_` são literais. |
| query | status | enum | não | OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED ou ALL; ausente equivale a ALL. |
| query | severity | enum | não | TRIVIAL, MINOR, NORMAL, MAJOR, CRITICAL ou BLOCKER; ausente inclui todas. |

Filtros combinados por AND, exatamente como `GET /api/v1/defects`.
Sem body; não aceita page, size, sort, from, to, category, environmentId ou
outros parâmetros. Não enviar a query de paginação da tabela ao resumo.

```http
GET /api/v1/defects/summary?workspaceId=00000001-0000-4000-8000-000000000001&status=ALL&q=Login
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**, `application/json`, `Cache-Control: no-store`, `X-Request-Id`.
Envelope habitual, sem meta.pagination. Datas HTTP com offset -03:00; banco e
cálculo usam instantes UTC. generatedAt é o instante desta consulta.

```json
{
  "data": {
    "generatedAt": "2026-10-08T15:00:00.000-03:00",
    "totalBugs": 15,
    "byStatus": { "OPEN": 2, "IN_PROGRESS": 1, "RESOLVED": 2, "CLOSED": 10, "REJECTED": 0 },
    "byCategory": { "HOMOLOGATION": 10, "PRODUCTION": 5, "OTHER": 0, "UNSPECIFIED": 0 },
    "resolutionTime": { "averageHours": 18.5, "sampleSize": 12, "basis": "CREATED_TO_RESOLVED" }
  },
  "message": "Indicadores consultados com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-08T15:00:00.000-03:00"
  }
}
```

- totalBugs e todas as contagens são inteiros não negativos. Todos os cinco
  estados e quatro categorias aparecem, inclusive zeros. A soma de cada
  distribuição corresponde a totalBugs; situação é a atual do defeito.
- byCategory utiliza `environmentSnapshot.category`; renomear, reclassificar
  ou inativar o cadastro de ambiente não modifica o histórico. Sem ambiente
  conta UNSPECIFIED; snapshot sem categoria reconhecida também fica nesse grupo.
- Fechamento sem resolução anterior também registra resolvedAt e passa a integrar
  a amostra. Fechar após resolução preserva o marco já registrado. A base
  CREATED_TO_RESOLVED permanece compatível; fechamento representa conclusão.
- resolutionTime.averageHours é a média global de `(resolvedAt-createdAt)` em
  horas corridas, arredondada até duas casas decimais depois de somar as durações
  individuais. Não há média de médias de Workspaces/projetos.
- Elegíveis: defeitos filtrados atualmente RESOLVED/CLOSED com resolvedAt
  registrado e maior ou igual a createdAt. Rejeitados, abertos, em correção,
  legados sem marco confiável e duração negativa não entram em sampleSize.
- Sem amostra: `{ "averageHours": null, "sampleSize": 0, "basis": "CREATED_TO_RESOLVED" }`.
  Duração real zero retorna averageHours=0. Não substituir null por zero.
- resolutionTime aceita null no contrato para uma fonte de duração indisponível.
  Esta versão tem fonte própria e retorna o objeto, inclusive sem amostra.
  Falhas de consulta retornam erro HTTP; nunca resultado parcial ou zeros fabricados.

Projeto/inventário vazio: totalBugs=0, todas as chaves das distribuições=0 e
objeto resolutionTime sem amostra, conforme acima.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID, enum, texto ou query extra inválidos. | Corrigir filtros; usar errors quando presente. |
| 401 | AUTH_UNAUTHENTICATED / erros AUTH_* da sessão | Token ausente/inválido ou sessão revogada/expirada. | Seguir [autenticação](authentication.md), sem renovação em loop. |
| 404 | RESOURCE_NOT_FOUND | Escopo explícito inexistente ou não autorizado. | Retirar resultados do escopo; não inferir existência de fontes ocultas. |
| 500 | INTERNAL_ERROR | Falha inesperada de consulta. | Mostrar detail/requestId e permitir repetição manual; não exibir total parcial. |
| 503 | SERVICE_UNAVAILABLE | Dependência indisponível, conforme tratamento compartilhado. | Preservar filtros e permitir repetição; não interpretar como zero. |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "instance": "/api/v1/defects/summary",
  "code": "RESOURCE_NOT_FOUND",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-08T15:00:00.000-03:00"
}
```

GET não altera dados e pode ser repetido. Falha de rede/timeout não confirma
quantidades; conservar requestId quando houver resposta. Em API antiga, um 404
pode representar rota ausente; após disponibilidade confirmada, um 404 com
escopo explícito segue a regra de acesso acima, sem fallback que amplie o escopo.

### Fluxo de integração

1. Usar os **filtros aplicados** da tabela; consultar lista e resumo com o mesmo
   workspaceId/projectId/q/status/severity, retirando page/size/sort do resumo.
2. Buscar, atualizar ou receber notificação de alteração renova os indicadores.
   Trocar página/ordenação não exige recalcular quantidades. Não aplicar filtros
   ainda não confirmados no formulário.
3. Cancelar solicitações anteriores ao mudar escopo/filtros ou sair; limpar
   resultados antigos. Evitar associar uma resposta atrasada ao novo contexto.
4. Mapear backlog=OPEN, correção=IN_PROGRESS, encerrados=CLOSED. RESOLVED permanece
   separado de CLOSED nos gráficos. Preservar OTHER e UNSPECIFIED.
5. Exibir média, sampleSize e legenda “Da criação até a resolução”. Ausência de
   amostra/fonte mostra indisponibilidade; zero real continua visível como zero.
6. Em erro, retirar loading, mostrar mensagem e permitir repetição manual.
   Não somar páginas incompletas como se representassem o total confirmado.

### Alterações e compatibilidade

- **Criação:** uma nova operação; OpenAPI atual com 186 operações.
- **Ajuste de 08/10/2026:** fechar registra resolvedAt quando ausente. Não requer
  migration adicional nem payload novo no front; atualizar resumo após a mutação.
  Registros já fechados sem marco não recebem backfill automático.
- **Front:** recarregar a página para sair da detecção da API antiga e consumir
  a rota; o fallback de leitura de todas as páginas deixa de ser necessário.
- **Migration:** aplicar `202610080002_defect_resolution` no histórico do dialeto
  configurado com `npm run migration:deploy`, antes de iniciar a API atualizada.
  Migration aditiva/nullable; não usar reset/db push. Histórico anterior fica null.
- A rota analítica por Workspace continua com from/to e limite de 36 meses,
  conforme [seu contrato](defect-analytics.md). Ela não substitui este resumo.
- Consultas da lista e do resumo são requisições distintas; uma alteração entre
  ambas pode mudar os números. Cada consulta aplica autorização/contagem de
  forma transacional, sem mistura parcial entre fontes.
- **Verificação:** testes HTTP/contrato, ciclo de resolução, média ponderada,
  zero/ausência/legados, snapshots, filtros, projetos arquivados e isolamento em
  MySQL 8.4 e MariaDB 10.11 descartáveis. Banco da aplicação não migrado por esta entrega.

## Marco de resolução — endpoints de defeitos existentes

DefectResponse de todas as [rotas de defeitos](defects.md) e DefectInventoryResponse
em `GET /api/v1/defects` acrescentam **resolvedAt**, date-time ou null, obrigatório
na resposta. O cliente não pode enviar resolvedAt no POST/PATCH: é dado do servidor.
Listagem e detalhe não recalculam nem alteram o marco.

### PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}

Mantém Bearer, defect.manage, projeto ativo, version atual, payload/erros/envelope
[documentados](defects.md#patch-apiv1workspacesworkspaceidprojectsprojectiddefectsdefectid).

| Alteração de estado | resolvedAt |
| --- | --- |
| Estado diferente → RESOLVED | Instante atual do servidor, na mesma transação da alteração/auditoria. |
| Estado diferente → CLOSED | Preserva resolvedAt existente; se null, grava o instante atual do fechamento. |
| Estado diferente → OPEN/IN_PROGRESS/REJECTED | Limpa para null; invalida a resolução anterior. |
| Mesmo estado | Preserva; somente status atual é no-op com version atual. |
| Metadados, ambiente, anexos ou referência externa | Preserva; updatedAt não serve para duração. |

Reabrir e resolver/fechar novamente mede da **criação original** até a nova conclusão,
sem acumular ou subtrair ciclos. Registros antigos RESOLVED/CLOSED permanecem null
até uma nova transição real a RESOLVED/CLOSED; repetir o estado ou editar não fabrica data.
Conflito 409 continua exigindo reconsulta/reconciliação; a falha não modifica o marco.

### GET /api/v1/defects

Filtros, paginação, ordenação e envelope [existentes](product-improvements.md)
preservados; resolvedAt é aditivo. Escopo explícito sem acesso agora retorna 404
consistente com o resumo, incluindo Workspace sem grant defect.read. Global sem
fontes continua vazio. Autorizações e leitura compartilham a transação do inventário.
