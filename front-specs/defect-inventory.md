# Inventário consolidado de defeitos

Atualização de 08/10/2026: consulta autenticada sem quota geral de requisições.

Disponível na API v1 em 06/10/2026. operationId: listDefectInventory.

## GET /api/v1/defects

### Objetivo e acesso

Bearer. Retorna defeitos de todos os Workspaces ativos com membership atual e dos
projetos em que há defect.read efetivo. Projetos arquivados são incluídos. Não
concede acesso por UUID/role claim; aplica os grants atuais e escopo de projeto.
Não exige Workspace previamente selecionado. Sem fontes autorizadas retorna []/0.

### Requisição

| Local | Campo | Tipo | Obrigatório | Padrão/limites |
| --- | --- | --- | --- | --- |
| Header | Authorization | Bearer | sim | Access token |
| Query | page / size | inteiro | não | 1 / 20; page 1–100000, size 1–100 |
| Query | q | texto | não | 1–100; busca literal por título |
| Query | workspaceId / projectId | UUID v4 | não | Restringir ao escopo autorizado |
| Query | status | enum | não | ALL; OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED, ALL |
| Query | severity | enum | não | BLOCKER, CRITICAL, MAJOR, NORMAL, MINOR, TRIVIAL |
| Query | sort | campo,direção | não | createdAt,desc; campos createdAt,updatedAt,title,sequence; asc/desc |

Não recebe filtros de anexos/execução/ambiente. IDs vêm das listagens de
Workspaces/projetos ou das próprias linhas. ProjectId não autorizado retorna 404;
WorkspaceId desconhecido/não autorizado também. Sem filtros, fontes ocultas são
omitidas. Contagens e paginação são globais para o inventário filtrado.

```http
GET /api/v1/defects?page=1&size=20&status=OPEN&sort=createdAt,desc
Authorization: Bearer <accessToken>
```

### Respostas de sucesso

HTTP 200, Cache-Control no-store, X-Request-Id. Array data com metadados do defeito,
contexto de Workspace/projeto, humanId e snapshot do ambiente (nullable). Não contém
passos, bytes/anexos, descrições completas ou referências externas. Abrir os detalhes
na rota existente usando workspaceId/projectId/id; as permissões são revalidadas.

```json
{
 "data":[{"id":"33333333-3333-4333-8333-333333333333","workspaceId":"11111111-1111-4111-8111-111111111111","workspaceName":"Equipe QA","projectId":"22222222-2222-4222-8222-222222222222","projectName":"Portal","projectKey":"PORTAL","projectStatus":"ACTIVE","sequence":1,"humanId":"PORTAL-DEF-1","title":"Falha no login","status":"OPEN","severity":"CRITICAL","environmentId":null,"environmentSnapshot":null,"version":1,"createdAt":"2026-10-06T10:00:00.000-03:00","updatedAt":"2026-10-06T10:00:00.000-03:00"}],
 "message":"Defeitos consultados com sucesso.",
 "meta":{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","timestamp":"2026-10-06T10:00:00.000-03:00","pagination":{"page":1,"size":20,"totalItems":1,"totalPages":1,"hasNext":false,"hasPrevious":false}}
}
```

### Erros e tratamento no front-end

| HTTP | code | Condição | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID, enum, sort/query desconhecida ou paginação inválidos | Corrigir filtro |
| 401 | AUTH_UNAUTHENTICATED / AUTH_TOKEN_INVALID / AUTH_SESSION_REVOKED | Sessão inválida | Fluxo de autenticação existente |
| 404 | RESOURCE_NOT_FOUND | Escopo informado não autorizado | Remover filtro/contexto obsoleto |
| 503 | SERVICE_UNAVAILABLE | Dependência indisponível | Retry limitado |

Erros usam Problem Details com code/detail/requestId/timestamp e errors quando
houver validação de DTO. Não interpretar [] como erro de permissão. Um 503 não deve
limpar a sessão. Requisição de leitura pode ser refeita com política limitada.

### Fluxo de integração

1. Ao entrar em Defeitos, carregar o inventário sem seleção obrigatória de Workspace.
2. Renderizar abaixo da seleção de Workspace; aplicar filtros e paginação na API.
3. Abrir detalhes com IDs da linha; invalidar a tabela após mutações existentes.
4. Cancelar respostas obsoletas ao trocar filtros; preservar requestId nos erros.

### Alterações e compatibilidade

Rota nova; as rotas de defeitos por projeto permanecem disponíveis. Somente projetos
atualmente autorizados contribuem para dados e totais. Sem migration específica
para o inventário. Testes verificam cruzamento de Workspaces, participantes,
revogação, busca, paginação, filtros e projetos arquivados com bancos reais.
