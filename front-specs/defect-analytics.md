# Ambientes, cadastro de defeitos e gráficos de bugs

## Funcionalidade: relatório de defeitos por ambiente

- **Disponibilidade:** implementado, API v1, atualização 04/10/2026.
- **OpenAPI:** `getDefectAnalytics`, `/docs-json` e [snapshot](openapi.json).
- **Resumo:** uma consulta fornece os dados dos gráficos de histórico mensal,
  cartões, distribuição por projeto/ambiente e projetos em Homologação/Produção.

## Área específica de Ambientes — especificação para o front

Criar uma entrada **Ambientes** no contexto de Projetos, com seleção explícita
Workspace/projeto. Ambientes pertencem a um projeto; não são um cadastro global
compartilhado. Reutilizar as cinco [rotas de projetos](projects.md):

| Ação | Endpoint | Acesso efetivo |
| --- | --- | --- |
| Listar | GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/environments | project.read |
| Cadastrar | POST no mesmo caminho | environment.manage; projeto ACTIVE |
| Consultar | GET no mesmo caminho/{environmentId} | project.read |
| Editar/desativar | PATCH no mesmo caminho/{environmentId} | environment.manage; projeto ACTIVE |
| Excluir logicamente | DELETE no mesmo caminho/{environmentId} | environment.manage; projeto ACTIVE |

A listagem já oferece page/size/q/sort e active=true/false; ausente inclui ativos
+inativos, excluídos logicamente são omitidos. Carregar todas as páginas para
seletores; não considerar a primeira página como catálogo completo.

Formulário: nome obrigatório (1..100), descrição opcional (até 500/null), ativo
(booleano, padrão true) e **categoria**: PRODUCTION (Produção), HOMOLOGATION
(Homologação), OTHER (Outro). categoria opcional na API, padrão OTHER; no novo
formulário solicitar escolha explícita para evitar classificação ambígua.
PATCH aceita category sem trocar nome; null/categoria desconhecida retorna 400.
Nome segue unicidade existente no projeto, sem distinção de caixa/acentos.

```json
{ "name": "Homologação", "description": "Validação antes da produção", "category": "HOMOLOGATION", "active": true }
```

Cadastro/edição retornam EnvironmentResponse com `category` obrigatório.
Exclusão retorna 204; não remove histórico. Mostrar estado inativo; selecionar
somente ativos para novas associações. Datas/status de execução permanecem
separados do cadastro do ambiente. Grants vêm do acesso efetivo, nunca do token.
Após alteração, invalidar lista/detalhe/seletores do projeto; mudanças no
cadastro não reclassificam defeitos existentes nem snapshots de execuções.

## Ambiente no cadastro de defeitos — endpoints existentes

- POST defects e POST defects/from-failure aceitam `environmentId` UUID v4/null;
  PATCH defects/{defectId} aceita o mesmo campo com version atual.
- Defeito avulso: ausente/null = sem ambiente. Falha vinculada: ausente herda
  ambiente da execução (incluindo cadastro hoje desativado/excluído); null
  declara sem ambiente; UUID explícito substitui e precisa estar ativo.
- Essa herança também se aplica a POST defects com testRunCaseId. Nome herdado
  vem do snapshot da Run; categoria vem do cadastro na criação do defeito.
- Ambiente estrangeiro, inexistente, inativo ou excluído em atribuição explícita:
  404 RESOURCE_NOT_FOUND. UUID inválido: 400; version obsoleta: 409
  DEFECT_VERSION_CONFLICT. Preservar grants defect.manage e testrun.read
  quando vincular falha; projetos arquivados não aceitam escrita.
- Todas as respostas de defeitos acrescentam environmentId UUID/null e
  environmentSnapshot {name,category}/null. Exibir o snapshot histórico; não
  substituir silenciosamente por cadastro renomeado. PATCH null remove ambos;
  UUID explícito copia nome/categoria atual. Outros campos preservam associação.
- GET defects acrescenta filtro opcional environmentId UUID, inclusive para
  consultar histórico de ambiente inativo/excluído; sem esse filtro mantém
  listagem anterior. Os demais filtros/paginação continuam iguais.
- Cadastro antigo de ambiente recebe OTHER; defeitos antigos ficam sem
  ambiente. Oferecer edição explícita para classificar registros antigos.

```json
{ "title": "Erro ao confirmar pedido", "severity": "NORMAL", "environmentId": "33333333-3333-4333-8333-333333333333" }
```

Não exigir ambiente em consumidores antigos; o novo front pode solicitá-lo
no formulário. Disponibilizar “Sem ambiente” conscientemente; não tratar null
como Produção. Permitir escolher ambiente do projeto antes de salvar. Atualizar
lista/detalhe/gráficos após mutação explícita; 409 recarrega versão e pede revisão.

## GET /api/v1/workspaces/{workspaceId}/defects/analytics

### Objetivo e acesso

Bearer/sessão válidos, Workspace/membro ACTIVE e defect.read atual. Consolidar
somente projetos acessíveis onde a permissão é efetiva, por participação/grupo
ou project.manage_all conforme regras existentes. Inclui projetos arquivados
acessíveis para histórico. Sem projetos autorizados: zero e listas vazias.
Projeto explícito inacessível/estrangeiro: 404; grant ausente: 403. Sem nomes,
IDs ou contagens de outros tenants/projetos. GET sem escrita/auditoria.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer accessToken | Sim | Sessão atual |
| rota | workspaceId | UUID v4 | Sim | Seleção atual |
| query | from | data real YYYY-MM-DD | Sim | Primeiro dia inclusivo, UTC |
| query | to | data real YYYY-MM-DD | Sim | Último dia inclusivo, UTC; >=from |
| query | projectId | UUID v4 | Não | Ausente consolida projetos autorizados |
| query | category | PRODUCTION, HOMOLOGATION, OTHER, UNSPECIFIED | Não | Ausente inclui todas; UNSPECIFIED = sem ambiente |

Até 36 meses civis abrangidos. Sem body/paginação/status/busca/ordenação;
query desconhecida/repetida, UUID/data/enum inválidos ou intervalo excessivo: 400.

```http
GET /api/v1/workspaces/11111111-1111-4111-8111-111111111111/defects/analytics?from=2026-09-01&to=2026-09-30
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP 200, application/json, Cache-Control: no-store, X-Request-Id; sem pagination.
Contagens são inteiros não negativos. Todos os cinco estados e quatro grupos
de categoria aparecem nos objetos de contagens mesmo com zero.

```json
{
  "data": {
    "generatedAt": "2026-10-04T09:00:00.000-03:00",
    "period": { "from": "2026-09-01", "to": "2026-09-30", "dateField": "createdAt", "timezone": "UTC" },
    "totalBugs": 2,
    "byStatus": { "OPEN": 1, "IN_PROGRESS": 0, "RESOLVED": 0, "CLOSED": 1, "REJECTED": 0 },
    "byCategory": { "PRODUCTION": 1, "HOMOLOGATION": 1, "OTHER": 0, "UNSPECIFIED": 0 },
    "monthly": [ { "month": "2026-09", "totalBugs": 2, "byCategory": { "PRODUCTION": 1, "HOMOLOGATION": 1, "OTHER": 0, "UNSPECIFIED": 0 } } ],
    "byProject": [ { "projectId": "22222222-2222-4222-8222-222222222222", "projectKey": "PORTAL", "projectName": "Portal", "totalBugs": 2, "byCategory": { "PRODUCTION": 1, "HOMOLOGATION": 1, "OTHER": 0, "UNSPECIFIED": 0 } } ],
    "byEnvironment": [
      { "projectId": "22222222-2222-4222-8222-222222222222", "environmentId": "33333333-3333-4333-8333-333333333333", "name": "Homologação", "category": "HOMOLOGATION", "totalBugs": 1 },
      { "projectId": "22222222-2222-4222-8222-222222222222", "environmentId": "44444444-4444-4444-8444-444444444444", "name": "Produção", "category": "PRODUCTION", "totalBugs": 1 }
    ]
  },
  "message": "Indicadores de defeitos consultados com sucesso.",
  "meta": { "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "timestamp": "2026-10-04T09:00:00.050-03:00" }
}
```

- monthly: todos os meses do intervalo, em ordem crescente, incluindo zeros;
  primeiro/último mês respeitam dias from/to, sem expandir a janela.
- byProject: todos os projetos autorizados do filtro, inclusive zeros, nome
  ASC/id ASC; sem limite de cartões que trunque somas.
- byEnvironment: grupos não vazios por projeto/ID/nome/categoria do snapshot;
  ordenação projectId/category/name/environmentId ASC. Sem ambiente: ID/nome
  null, categoria UNSPECIFIED. Mesmo cadastro renomeado pode ter grupos
  históricos distintos; para comparação entre projetos, usar byCategory.
- Todas as distribuições respeitam a mesma janela/filtros e totalBugs; o
  relatório usa data de criação e **situação atual**. “CLOSED” é quantidade de
  bugs hoje encerrados que foram criados no período; não encerramentos ocorridos
  no período. Não existe reconstrução de situação histórica nesta entrega.

### Dados para os gráficos solicitados

| Elemento do front | Fonte |
| --- | --- |
| Histórico mensal por ambiente | monthly[].month e monthly[].byCategory.PRODUCTION/HOMOLOGATION |
| Total de bugs do mês | totalBugs, em consulta from/to daquele mês |
| Em backlog | byStatus.OPEN |
| Em correção | byStatus.IN_PROGRESS |
| Encerrados | byStatus.CLOSED; RESOLVED e REJECTED permanecem separados |
| Bugs em homologação / produção | byCategory.HOMOLOGATION / PRODUCTION |
| Total por projeto | byProject[].totalBugs |
| Total por ambiente | byCategory; detalhamento opcional em byEnvironment |
| Homologação por projeto | byProject[].byCategory.HOMOLOGATION |
| Produção por projeto | byProject[].byCategory.PRODUCTION |

OTHER/UNSPECIFIED devem permanecer visíveis ou explicitamente indicados; os
valores não se tornam homologação/produção. Não descartar grupos do denominador.
Ano fiscal é intervalo escolhido pelo front; o rótulo “FY 2027” não define
sozinho os limites. Selecionar início/fim reais. Para histórico amplo e cartões
mensais, fazer uma consulta por janela (histórico e mês selecionado), cancelando
as anteriores quando o contexto mudar. Gráficos por projeto/categoria do mesmo
mês usam a resposta já recebida, sem uma consulta por projeto.

### Erros e tratamento no front-end

| HTTP | code | Quando | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Data/UUID/query/intervalo inválidos | Corrigir filtro; associar errors |
| 401 | AUTH_UNAUTHENTICATED / AUTH_INVALID_ACCESS_TOKEN / AUTH_ACCESS_TOKEN_EXPIRED / AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Sessão/bearer | Fluxo de autenticação existente |
| 403 | AUTH_FORBIDDEN | Grant ausente | Revalidar acesso |
| 404 | RESOURCE_NOT_FOUND | Workspace/projeto inacessível | Remover dados daquele contexto |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | Falha inesperada/dependência | Preservar requestId, permitir retry manual; nunca converter em zero |

```json
{
  "type": "urn:lambdaquality:problem:resource-not-found", "title": "Recurso não encontrado", "status": 404,
  "detail": "Recurso não encontrado.", "instance": "/api/v1/workspaces/11111111-1111-4111-8111-111111111111/defects/analytics",
  "code": "RESOURCE_NOT_FOUND", "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "timestamp": "2026-10-04T09:00:00.050-03:00"
}
```

### Fluxo de integração

1. Preparar Workspace e período real, com seletor de projeto opcional.
2. Buscar analytics com bearer; exibir período/dateField/timezone retornados.
3. Montar todos os gráficos do mês da mesma resposta; usar agregados, sem
   carregar corpos de defeitos/anexos/execuções.
4. Distinguir consulta vazia de falha; preservar IDs para abrir projetos.
5. Cancelar consultas ao trocar contexto; limpar dados no logout. GET
   idempotente sem polling automático; falha de rede não é uma resposta HTTP.

### Alterações e compatibilidade

Em 08/10/2026, removida a quota geral de requisições autenticadas.

- **Tipo:** nova rota agregada e extensão aditiva de ambientes/defeitos.
- **Impacto:** consumidores antigos seguem válidos; novo front deve cadastrar
  categoria e usar environmentId/snapshot, incluindo a área de Ambientes acima.
- **Migração:** aplicar `202610040009_defect_environments`, com DATABASE_DIALECT
  correto, via npm run migration:deploy; reiniciar API após build. Não usar reset.
- **Limitação:** dados antigos sem associação não são reconstruídos; estados
  atuais da coorte por criação, sem histórico de transições por mês.
- **Verificação:** datas UTC/fronteiras, agregações multi-projeto/categoria,
  filtros, snapshots, herança explícita/nula, isolamento e migration aditiva
  em testes de integração, além de validação de contrato/intervalos.

## Resumo global do inventário — 08/10/2026

[GET /api/v1/defects/summary](defect-summary.md) atende todo o histórico autorizado,
sem limite de 36 meses, com os mesmos filtros do inventário global e tempo médio
da criação até resolução. Esta rota por Workspace permanece com seu contrato de
período e não calcula o novo indicador de duração.
