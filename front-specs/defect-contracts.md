# Contratos e integração de Defeitos

Fase 05 implementada, API v1, 02/10/2026. [9 endpoints](defects.md),
[OpenAPI](openapi.json) e [decisões](../codex/DEFECT_IMPLEMENTATION_DECISIONS.md).
Base /api/v1; UUID v4 e timestamps com offset -03:00. Envelopes/Problem Details seguem
[Workspace](workspace-contracts.md). JSON até 32 KiB; campos extras e query de
mutação rejeitados; GET detalhe não aceita query.

## Acesso e compatibilidade

| Role local | Capabilities possíveis, sempre intersectando grants do Workspace |
| ---------- | ---------------------------------------------------------------- |
| VIEWER     | defect.read                                                      |
| EDITOR     | defect.read, defect.manage                                       |
| MANAGER    | defect.read, defect.manage                                       |

read lista/consulta; manage cria/edita estados/metadados/vínculos. Owner e
Administrator têm ambas; Member recebe read com vínculo local. Grants customizados
não são ampliados; project.manage_all dispensa vínculo local, mantém grant da ação.
Backend revalida sessão/membership/grants atuais, nunca autoriza somente UUID/claims.
Projeto arquivado permite leitura e bloqueia toda escrita. 403 não concede permissão;
404 não revela recurso de outro tenant/projeto. Revogação vale na próxima requisição.

Catálogo passa de 27 para 29 permissions. WorkspaceResponse.permissions,
Role.permissionCodes e ProjectResponse.permissions podem incluir defect.read/manage.
Atribuir VIEWER/EDITOR/MANAGER verifica também capabilities de defect da role;
administradores customizados devem atualizar grants quando necessário. Payloads
de identidade, convites, execuções e biblioteca de arquivos mantêm contrato.
Aplicar migration aditiva 202610020005_defects antes de iniciar a nova API.

## Criação e origem de falha

POST /defects exige title trim 1–250, description opcional/nula até 10000,
severity opcional (padrão NORMAL), testRunCaseId opcional/nulo e attachmentIds
opcional (padrão [], até 100 UUID v4 distintos; não null). Nasce OPEN/version=1.
Sequence é positiva, imutável, transacional por Workspace/Project; independente
de TestCase. humanId é Project.key + "-DEF-" + sequence (exemplo QA-DEF-1).
Não aceitar sequence, status inicial, version inicial ou createdBy do cliente.

Origem preenchida exige também testrun.read e resultado atual FAILED da cópia
no mesmo projeto. POST /defects/from-failure exige testRunCaseId e aceita title/
severity/description opcionais: ausentes herdam titleSnapshot/severitySnapshot/
comment do resultado; description=null limpa. IDs vêm de RunCase, não TestCase.
NOT_TESTED/PASSED/BLOCKED/SKIPPED não representam falha. Permite FAILED em Run
IN_PROGRESS/COMPLETED/ABORTED; todos os vínculos são validados transacionalmente.

Origem é imutável após criação. Resposta fornece testRunCaseId e testRunId para
navegação. Defeito não modifica version, resultados ou snapshots do Run. Resultados
IN_PROGRESS podem mudar depois; vínculo permanece como origem sem garantir que
resultado atual será sempre FAILED. Múltiplos defeitos podem apontar para a mesma
falha. Não copia snapshots adicionais: GET das cópias exige testrun.read.
Filtro testRunCaseId na listagem também exige testrun.read e cópia do escopo.

## Estado e concorrência

OPEN/IN_PROGRESS/RESOLVED/CLOSED/REJECTED. PATCH aceita qualquer estado do enum,
inclusive retornar para OPEN; não impõe workflow do sistema externo. Também
edita title/description/severity. Pelo menos um campo além de version; ausente
mantém, description=null limpa. Origem/sequence/projeto não são editáveis.
Sem archive/hard delete. createdBy/createdAt permanecem; updatedAt acompanha escrita.

Toda mutação existente exige version atual do Defect (inteiro >=1), incrementa
version/updatedAt e audita. DEFECT_VERSION_CONFLICT (409) exige reconsultar e
conciliar. Repetir somente status atual, remover referência externa já ausente,
ou adicionar/remover vínculo já presente/ausente são no-op com version atual.
Adicionar ainda exige arquivo disponível e permission. POST de referência
externa incrementa mesmo com tríade igual; PATCH de metadados incrementa.
Criação não é idempotente; timeout exige consultar estado antes de repetir.

## Referência externa e anexos privados

POST /{defectId}/external-link substitui externalSystem trim 1–50,
externalIssueId trim 1–250 e externalUrl 1–2048. Todos obrigatórios juntos.
URL HTTP/HTTPS absoluta sem credenciais, espaços, controles ou backslash; não
trim automático. DELETE com body version limpa a tríade; ausente é no-op.
Referência manual, sem chamada remota, sincronização, SDK ou prova de existência.
Múltiplos defeitos podem apontar para a mesma issue; sem unicidade externa.

Criação com anexos e POST /{id}/attachments exigem attachment.read e arquivos
ativos do mesmo Workspace, além de defect.manage. Até 100 vínculos totais;
DefectAttachment é tipado e usa FKs compostas. Attachment é biblioteca tenant-wide,
podendo ser reutilizado entre projetos do mesmo Workspace. Arquivos excluídos
logicamente permanecem vinculados, ocultos em attachmentIds, sem novas associações.
DELETE de vínculo não apaga bytes e não exige attachment.delete; pode remover
vínculo histórico excluído. DefectResponse retorna somente UUIDs ativos, nunca
storageKey/URL pública/bytes. Metadados/download usam [biblioteca privada](workspace-attachments.md)
com attachment.read; upload/delete mantêm suas permissions próprias. defect.*
não concede acesso adicional a arquivos ou execução. Campos personalizados/tags
para Defect e integrações automatizadas ficam fora da entrega.

## Consulta e fluxo do front-end

Lista padrão inclui todos os estados, status=ALL equivale a sem filtro. q trim
1–100 busca title; severity/testRunCaseId filtram antes de paginar/contar.
page=1 (máximo 100000), size=20 (máximo 100), sort sequence/title/createdAt/
updatedAt com asc/desc, padrão sequence,asc, desempate id. Lista vazia 200,
data=[], totalItems/totalPages=0, has*=false. Respostas 200/201 JSON/no-store;
criações têm Location. Todas trazem X-Request-Id. Desde 08/10/2026, operações autenticadas
de defeitos não têm quota geral de requisições.

1. Selecionar Workspace/Project, consultar permissions e listar defeitos.
2. Criar avulso ou abrir falha FAILED em [execuções](execution-contracts.md) e enviar from-failure.
3. Mostrar humanId e dados retornados; editar estado/metadados com version atual.
4. Anexar IDs obtidos por upload/lista privada, mantendo autorização para download.
5. Gravar/remover referência externa manual; atualizar dados/version e listas.

Cache inclui Workspace/Project/defectId; mudança de escopo/logout limpa dados.
Resultados de escrita atualizam version; serialize alterações do mesmo Defect.
Tratar HTTP/code, errors[].field/code/message e preservar requestId para suporte.
401 segue [autenticação](authentication.md); 403 atualiza acesso, 404 atualiza
contexto sem confirmar outro tenant. GET pode repetir com backoff; mutação após
rede/timeout exige confirmar servidor antes de reenviar. Sem chaves idempotentes.

## DefectResponse

Todos os campos abaixo são obrigatórios na resposta; campos nullable são null
explícito e arrays vazios são []. Dados de ator/hora vêm do servidor.

| Campo           | Tipo/formato | Regras                                                  |
| --------------- | ------------ | ------------------------------------------------------- |
| id              | uuid         | Conforme contrato compartilhado.                        |
| workspaceId     | uuid         | Conforme contrato compartilhado.                        |
| projectId       | uuid         | Conforme contrato compartilhado.                        |
| sequence        | number       | Conforme contrato compartilhado.                        |
| humanId         | string       | Conforme contrato compartilhado.                        |
| title           | string       | Conforme contrato compartilhado.                        |
| description     | string       | Aceita null.                                            |
| severity        | string       | Enum: TRIVIAL, MINOR, NORMAL, MAJOR, CRITICAL, BLOCKER. |
| status          | string       | Enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED.    |
| testRunCaseId   | uuid         | Aceita null.                                            |
| testRunId       | uuid         | Aceita null.                                            |
| externalSystem  | string       | Aceita null.                                            |
| externalIssueId | string       | Aceita null.                                            |
| externalUrl     | uri          | Aceita null.                                            |
| version         | number       | Conforme contrato compartilhado.                        |
| createdBy       | uuid         | Conforme contrato compartilhado.                        |
| createdAt       | date-time    | Conforme contrato compartilhado.                        |
| updatedAt       | date-time    | Conforme contrato compartilhado.                        |
| resolvedAt      | date-time    | Null ou resolução registrada do ciclo atual; servidor define. |
| attachmentIds   | string[]     | Conforme contrato compartilhado.                        |

## Ambiente e gráficos — 04/10/2026

[Contrato entregue](defect-analytics.md): environmentId/snapshot no defeito, categoria de ambiente e relatório agregado; inclui especificação da área de cadastro para o front. Aplicar migration 202610040009_defect_environments.

## Resolução e inventário global — 08/10/2026

[Contrato atualizado](defect-summary.md): resolvedAt obrigatório/nullable nas
respostas, ciclo de resolução e resumo global com tempo médio da criação até
resolução. Aplicar migration `202610080002_defect_resolution`; legados sem marco
confiável não entram na amostra. Não enviar resolvedAt ao criar/editar.

Ajuste de 08/10/2026: fechar (CLOSED) também preenche resolvedAt com o instante
do servidor quando ausente; resolução anterior é preservada. Atualizar lista e
resumo após fechar. Sem novo payload ou migration; históricos sem marco não são
preenchidos retroativamente.

## Comentários e histórico — 09/10/2026

[Contrato atualizado](defect-history.md): PATCH aceita comment trim 1–10000 e
atualização apenas de comentário, com version do defeito. Novo GET /{defectId}/history
usa defect.read e paginação; novos eventos são transacionais e imutáveis. Migration
`202610090001_defect_history` recupera auditoria antiga disponível sem inventar
transições/comentários/nomes ausentes. DefectResponse e description não mudam.
