# Comentários e histórico de defeitos

## Funcionalidade: atualização e histórico unificado

- **Disponibilidade:** implementado, API v1, 09/10/2026.
- **OpenAPI:** `updateDefect`, `listDefectHistory`, `/docs-json` e [snapshot](openapi.json).
- **Resumo:** atualizar situação/comentário e consultar o histórico durável do defeito.
- **Limitação do legado:** a migration recupera eventos `defect.*` da auditoria
  disponível, preservando ID, autor e data. A auditoria antiga não contém a
  transição, o comentário ou o nome histórico: esses campos são null. Eventos
  ausentes da auditoria não podem ser reconstruídos. Não inferir situações
  antigas a partir do estado atual, updatedAt ou ordem dos eventos.

## PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}

### Objetivo e acesso

Bearer, Workspace ativo, membership atual, projeto visível/ativo e permissão
**efetiva** `defect.manage`, conforme [contratos](defect-contracts.md). Leitores
não escrevem; projetos arquivados bloqueiam escrita. IDs UUID v4 vêm da seleção
do Workspace/projeto e da consulta/criação do defeito. Não há grant adicional.

Comentário é texto simples append-only: não substitui description nem apaga ou
edita comentários anteriores. Autor é o usuário autenticado; hora é do servidor.
Alteração, incremento de version/updatedAt, evento e auditoria são transacionais.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer access token | sim | Sessão atual. |
| path | workspaceId/projectId/defectId | UUID v4 | sim | Mesmo escopo do detalhe. |
| body | version | inteiro >=1 | sim | Version atual **do defeito**, inclusive comentário isolado. |
| body | comment | string | não | Trim, 1–10000 caracteres; null, vazio e tipos não textuais são inválidos. |
| body | status | enum | não | OPEN, IN_PROGRESS, RESOLVED, CLOSED ou REJECTED. |
| body | title/description/severity/environmentId | conforme PATCH existente | não | [Contrato completo](defects.md#patch-apiv1workspacesworkspaceidprojectsprojectiddefectsdefectid), preservado. |

Enviar pelo menos um campo além de version. Somente comentário, somente status
ou ambos são aceitos; comentário pode acompanhar edição completa. Omitir comment
não cria comentário. JSON UTF-8, até **32 KiB**, incluindo os demais campos;
limite de caracteres não amplia o limite de bytes. Não enviar query, campos extras,
autor, data, ID do evento ou resolvedAt. Não há upload de arquivos neste payload.

```http
PATCH /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "version": 5,
  "status": "IN_PROGRESS",
  "comment": "Investigação iniciada; falha reproduzida em homologação."
}
```

Comentário isolado: `{ "version": 5, "comment": "Investigação iniciada." }`.

### Respostas de sucesso

HTTP **200**, `application/json`, `Cache-Control: no-store`, `X-Request-Id`.
Retorna DefectResponse habitual, sem inserir comment na descrição ou no objeto
Defect. O comentário aparece no GET de histórico. Exemplo do retorno acima:

```json
{
  "data": {
    "id": "00000003-0000-4000-8000-000000000001",
    "workspaceId": "00000001-0000-4000-8000-000000000001",
    "projectId": "00000002-0000-4000-8000-000000000001",
    "sequence": 1,
    "humanId": "QA-DEF-1",
    "title": "Login falhou",
    "description": "Painel não abriu.",
    "severity": "NORMAL",
    "status": "IN_PROGRESS",
    "testRunCaseId": null,
    "testRunId": null,
    "externalSystem": null,
    "externalIssueId": null,
    "externalUrl": null,
    "environmentId": null,
    "environmentSnapshot": null,
    "version": 6,
    "createdBy": "00000004-0000-4000-8000-000000000001",
    "createdAt": "2026-10-09T08:00:00.000-03:00",
    "updatedAt": "2026-10-09T11:30:00.000-03:00",
    "resolvedAt": null,
    "attachmentIds": []
  },
  "message": "Defeito atualizado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-09T11:30:00.000-03:00"
  }
}
```

Comentário isolado incrementa version e updatedAt e gera um evento UPDATED com
fromStatus/toStatus=null. Status diferente gera UPDATED com transição; se vier
comentário junto, fica no **mesmo** evento. Status atual sem comentário, quando
é o único campo, continua no-op: não incrementa versão nem duplica eventos.
Status atual com comentário grava o comentário e incrementa versão; transição
permanece null. Edição completa registra a transição quando status mudar.
Edições de metadados, referência externa e anexos também geram UPDATED sem
comentário/transição, mas este evento não detalha os campos alterados.

Regras de [resolvedAt](defect-summary.md) permanecem: resolver registra a hora;
fechar preserva resolução ou grava hora quando ausente; reabrir/rejeitar limpa.
Comentário isolado não altera resolução. Não usar histórico incompleto do legado
para recalcular esse marco nem o tempo médio.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Campo extra, UUID, enum, versão, comentário inválidos ou payload vazio. | Corrigir formulário usando errors quando presente; preservar texto em memória. |
| 401 | AUTH_UNAUTHENTICATED / erros AUTH_* | Sessão/token inválidos. | Seguir [autenticação](authentication.md). |
| 403 | AUTH_FORBIDDEN | Sem defect.manage no projeto visível. | Atualizar acesso; não reenviar automaticamente. |
| 404 | RESOURCE_NOT_FOUND | Fora do escopo/acesso atual ou inexistente. | Retirar contexto antigo sem revelar outro tenant. |
| 409 | DEFECT_VERSION_CONFLICT | Versão desatualizada. | Reconsultar detalhe/histórico e pedir reconciliação. |
| 409 | PROJECT_ARCHIVED | Projeto arquivado. | Manter histórico disponível; impedir escrita. |
| 413 | PAYLOAD_TOO_LARGE | JSON acima de 32 KiB. | Reduzir payload/textos. |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | Falha de persistência/dependência. | Preservar requestId; consultar estado antes de reenviar. |

```json
{
  "type": "urn:lambdaquality:problem:defect-version-conflict",
  "title": "Solicitação não concluída",
  "status": 409,
  "detail": "O defeito foi alterado. Consulte a versão atual antes de tentar novamente.",
  "instance": "/api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001",
  "code": "DEFECT_VERSION_CONFLICT",
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "timestamp": "2026-10-09T11:30:00.000-03:00"
}
```

Não há chave de idempotência nesta entrega. O version check impede aplicar
novamente a mesma versão depois de uma escrita confirmada; reenviar texto com
**nova** versão pode duplicá-lo. Após rede/timeout/5xx, não repetir automaticamente:
consultar detalhe e histórico e revisar o estado antes de reenviar. Bloquear
submissões simultâneas. Falhas transacionais não deixam atualização/evento parcial.

### Fluxo de integração

1. Consultar detalhe/version e disponibilidade do histórico. Oferecer comentário
   somente quando GET /history tiver sucesso e houver defect.manage efetivo.
2. Enviar status/comment desejados; omitir comment se não houver texto. Renderizar
   e armazenar em memória como texto, sem usar description como alternativa.
3. Em sucesso, aplicar Defect/version/updatedAt retornados; reconsultar histórico
   e atualizar inventário, card OPEN e [resumo](defect-summary.md).
4. Em conflito ou resposta incerta, reconsultar e conciliar sem perder o texto.
   Limpar dados na troca de escopo/logout; não guardar histórico no navegador.

### Alterações e compatibilidade

Alteração aditiva do PATCH, entregue junto com GET /history. Payloads antigos
sem comment continuam válidos. Nenhuma alteração no DefectResponse, grants,
workflow de estados ou regra de resolvedAt. Migration e limites do legado estão
na seção do GET abaixo. Não requer integração remota ou chave de OCI.

## GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects/{defectId}/history

### Objetivo e acesso

Mesmo Bearer, Workspace ativo/membership e visibilidade do **detalhe**, com
`defect.read` efetivo. Projeto arquivado permite leitura. Não exige permissão
global de auditoria. Todas as consultas usam Workspace + projeto + defeito.
Histórico append-only: não existem endpoints de edição/exclusão de eventos.
Autor permanece com seu ID e snapshot de nome mesmo após sair do Workspace;
não depende de membership ativo para aparecer. Não retorna e-mail.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| header | Authorization | Bearer access token | sim | Sessão atual. |
| path | workspaceId/projectId/defectId | UUID v4 | sim | IDs do detalhe. |
| query | page | inteiro | não | Padrão 1, 1–100000. |
| query | size | inteiro | não | Padrão 20, 1–100. |
| query | sort | string | não | Padrão createdAt,asc; aceita createdAt,asc ou createdAt,desc; desempate id,asc. |

Sem body; query extra, busca, filtros por situação/autor e outros campos de
ordenação são rejeitados. Para a timeline, usar `size=100&sort=createdAt,asc`.

```http
GET /api/v1/workspaces/00000001-0000-4000-8000-000000000001/projects/00000002-0000-4000-8000-000000000001/defects/00000003-0000-4000-8000-000000000001/history?page=1&size=100&sort=createdAt,asc
Authorization: Bearer <access-token>
Accept: application/json
```

### Respostas de sucesso

HTTP **200**, `application/json`, `Cache-Control: no-store`, `X-Request-Id`;
array DefectHistoryResponse e paginação habitual. Datas ISO com offset -03:00.

```json
{
  "data": [
    {
      "id": "00000005-0000-4000-8000-000000000001",
      "type": "UPDATED",
      "actor": { "id": "00000004-0000-4000-8000-000000000001", "displayName": "Pessoa responsável" },
      "createdAt": "2026-10-09T11:30:00.000-03:00",
      "fromStatus": "OPEN",
      "toStatus": "IN_PROGRESS",
      "comment": "Investigação iniciada; falha reproduzida em homologação."
    }
  ],
  "message": "Histórico do defeito consultado com sucesso.",
  "meta": {
    "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "timestamp": "2026-10-09T11:30:01.000-03:00",
    "pagination": { "page": 1, "size": 100, "totalItems": 1, "totalPages": 1, "hasNext": false, "hasPrevious": false }
  }
}
```

Todos os campos do evento são obrigatórios na resposta; null é explícito:

| Campo | Tipo | Regra |
| --- | --- | --- |
| id | UUID | ID durável, imutável; legado reaproveita ID da auditoria. |
| type | CREATED / UPDATED | Criação avulsa/por falha ou atualização. |
| actor.id | UUID / null | ID do usuário histórico; null apenas se auditoria não registra autor. |
| actor.displayName | string / null | Snapshot do nome em novos eventos; null quando desconhecido, inclusive legado. |
| createdAt | date-time | Hora do servidor; legado usa occurredAt da auditoria, sem inferência. |
| fromStatus/toStatus | enum de defeito / null | Transição real em novos eventos; CREATED novo tem null/OPEN. Sem transição ou legado desconhecido: null/null. |
| comment | string / null | Texto simples, trim, até 10000 caracteres; ausente no evento é null. |

Uma atualização com status e comentário produz um único UPDATED. Outros tipos
não serão enviados nesta entrega. Defeito sem auditoria legada disponível pode
retornar histórico vazio: HTTP 200/data=[], totalItems/totalPages=0, has*=false.
Isso confirma suporte à rota, não completude de eventos antigos. Página além
do total também retorna array vazio com total real. Não limitar o histórico
às atividades recentes do dashboard ou aos últimos 100 eventos.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | IDs, paginação/ordenação ou query extra inválidos. | Corrigir consulta. |
| 401 | AUTH_* | Sessão/token inválidos. | Seguir autenticação. |
| 403 | AUTH_FORBIDDEN | Sem defect.read no projeto visível. | Tratar acesso, preservando requestId; não inferir ausência de suporte. |
| 404 | RESOURCE_NOT_FOUND | Defeito/escopo inexistente ou não autorizado. | Respeitar isolamento. Em API antiga, pode ser rota ausente. |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | Falha de consulta/dependência. | Mostrar indisponibilidade e repetição manual; não confirmar histórico parcial. |

Erros usam Problem Details, como acima, com instance apontando para `/history`.
GET pode ser repetido; falha de rede/timeout não representa array vazio. Esta
API entrega a rota e não emite 501 por ausência de suporte. O fallback de versões
antigas pode tratar 404/501 como indisponibilidade do recurso; 403, timeout e 5xx
continuam erros. Preservar requestId/Retry-After quando fornecidos; operações
negociais autenticadas não têm quota geral compartilhada.

### Fluxo de integração

1. Ao abrir o defeito, consultar todas as páginas em ordem cronológica. O sucesso
   confirma que o PATCH dessa versão suporta comment.
2. Ao receber nova version/estado, renovar histórico; cancelar consultas do
   defeito anterior e descartar respostas atrasadas. Usar ID do evento para
   evitar repetição visual ao concatenar páginas.
3. Renderizar comentário como **texto escapado**, preservando quebras de linha.
   Não executar HTML, links ativos embutidos ou Markdown do texto recebido.
   Mostrar nome quando conhecido; sem nome, usar indicação neutra, sem email.
4. Indicar que o histórico anterior à entrega pode estar incompleto. Campos de
   transição desconhecidos não significam estado OPEN nem transição inexistente.
5. Em falha de qualquer página, não apresentar a coleção parcial como histórica
   completa. Atualizações entre páginas podem mudar os totais; ao detectar nova
   version, reiniciar a leitura das páginas. Cada consulta é transacional.

### Alterações e compatibilidade

- **Criação:** uma rota, disponível junto com o PATCH de comentários; OpenAPI 187 operações.
- **Migration:** `202610090001_defect_history` nas histórias MySQL/MariaDB.
  Aplicar com `npm run migration:deploy` antes de iniciar a nova API; sem reset/db push.
  Cria defect_history_events e copia auditoria de defeitos existentes do mesmo Workspace.
- **Legado:** preserva eventos `defect.*` disponíveis, ID/data/autor originais,
  CREATED para criação e UPDATED para demais alterações. Não copia auditoria de
  outro Workspace ou de outro tipo de recurso. Não recupera transições/comentários
  desconhecidos nem cria evento sintético com createdAt/createdBy do estado atual.
- **Persistência:** novos eventos armazenam snapshot do nome e texto; não dependem
  de logs/dashboard, storage OCI ou caches do browser. Nenhuma edição/exclusão de evento pela API.
- **Contagem OPEN:** usar o [inventário global](defect-inventory.md) com status=OPEN,
  page=1/size=1 e workspaceId opcional, lendo totalItems. Histórico de criação não
  limita o estoque; demais status ficam fora. Overview e metrics.defects mantêm
  semântica por período. Não foi acrescentada metrics.openDefects opcional.
- **Validação:** testes HTTP/contrato e integração em bancos descartáveis, incluindo
  comentários, estados/reabertura, legado, >100 eventos, escopos/grants,
  concorrência/rollback e estoque OPEN antigo. Banco da aplicação não migrado nesta entrega.
