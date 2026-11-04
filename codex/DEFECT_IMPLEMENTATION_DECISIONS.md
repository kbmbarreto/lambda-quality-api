# Defeitos — decisões da Fase 05

Solicitada em 02/10/2026. Escopo: Defect, criação avulsa ou a partir de
falha de TestRunCase, estados, referência externa e anexos privados.
Governança, requisitos/rastreabilidade e integrações automatizadas ficam pendentes.
As alterações não commitadas da Fase 04 são preservadas nesta entrega.

## Modelo e autorização

Defect pertence a Workspace/Project; sequence imutável,contador DEFECT separado
de TEST_CASE com upsert/SELECT FOR UPDATE na mesma transação. humanId é
Project.key + "-DEF-" + sequence. version começa 1, toda escrita existente
exige versão atual; conflito DEFECT_VERSION_CONFLICT. Auditoria transacional
identifica ator/requestId, sem descrição, URL ou bytes nos eventos.

Duas permissions: defect.read e defect.manage. A especificação citava manage
como futura e não definia consulta: read mantém o padrão dos módulos entregues.
Member recebe read; Administrator recebe ambas; grants customizados intactos.
VIEWER permite read; EDITOR/MANAGER read/manage, sempre intersectando grants
atuais de Workspace. project.manage_all dispensa vínculo local mas não grant.
Projeto arquivado bloqueia toda escrita; leitura permanece disponível.

## Definição, falha e estados

Título trim 1–250, descrição opcional/nula até 10000, severity segue catálogo
TRIVIAL/MINOR/NORMAL/MAJOR/CRITICAL/BLOCKER. Avulso nasce OPEN, severity NORMAL
quando ausente. Pode incluir testRunCaseId opcional/nulo na criação.
POST /defects/from-failure exige testRunCaseId; title/severity ausentes herdam
snapshots da cópia e description ausente herda comment do resultado atual.
Ambos os fluxos com falha exigem também testrun.read no projeto e resultado
atual FAILED; BLOCKED/SKIPPED/NOT_TESTED/PASSED não constituem falha nesta fase.

Vínculo com a cópia é imutável após criação; FK composta Workspace/Project/
RunCase e RESTRICT preservam referência. Resposta retorna testRunId derivado
para navegar via API de execução, que continua exigindo testrun.read.
Criar/editar defeito nunca altera snapshots, resultados ou version do Run.
Resultado da execução IN_PROGRESS pode mudar depois; vínculo permanece como
origem, sem afirmar que resultado atual continuará FAILED. Múltiplos defeitos
podem apontar para a mesma falha. Sem cópia adicional dos snapshots em Defect.

Estados OPEN/IN_PROGRESS/RESOLVED/CLOSED/REJECTED. A especificação não definia
fluxo de transições: PATCH permite qualquer estado do enum, incluindo retorno
para OPEN, com autorização/version/auditoria; não impõe workflow externo.
PATCH também edita title/description/severity, sem trocar sequence/projeto/origem.
Exige pelo menos um campo além de version. Não há hard delete/archive de Defect.
Repetir apenas status atual com version atual é no-op, sem auditoria adicional.

## Referência externa e anexos

POST /{defectId}/external-link grava/substitui externalSystem (trim 1–50),
externalIssueId (trim 1–250) e externalUrl (1–2048, HTTP/HTTPS absoluto, sem
credenciais embutidas). Os três são obrigatórios juntos; DELETE limpa juntos.
URL é somente referência: sem chamada remota, SDK, validação de existência,
credencial de integração ou sincronização. Não há unicidade de issue externo,
permitindo agrupar defeitos na mesma issue. DELETE repetido é no-op com versão
atual. Dados externos não são aceitos no PATCH genérico/criação.

DefectAttachment é junção tipada Workspace/Project/Defect/Attachment; não criar
AttachmentLink polimórfico genérico. Criação aceita até 100 attachmentIds distintos;
POST /{id}/attachments adiciona e DELETE /{id}/attachments/{attachmentId} remove
somente vínculo. Criar/adicionar vínculo exige attachment.read, arquivo ativo
do mesmo Workspace e defect.manage; download/metadados seguem API privada com
attachment.read. Não concede attachment.upload/delete. Remover vínculo não apaga
arquivo. Consulta retorna apenas IDs ativos; soft delete preserva vínculo histórico
mas oculta ID e impede associação nova. Até 100 vínculos totais por defeito.
Adição/remoção repetidas são no-op com version atual; nova associação ainda
exige arquivo disponível. Campos personalizados/tags de Defect não integram a fase.

## API e banco

9 endpoints sob /api/v1/workspaces/{workspaceId}/projects/{projectId}/defects:
GET/POST coleção, POST /from-failure, GET/PATCH /{defectId}, POST/DELETE
/{defectId}/external-link, POST /{defectId}/attachments e DELETE
/{defectId}/attachments/{attachmentId}. GET/POST
coleção contam dois; cada método separado. Listagem paginada com q no título,
status/ALL, severity, testRunCaseId; sort sequence/title/createdAt/updatedAt,
padrão sequence,asc, desempate id; filtros antes de paginação/contagem.

Todos retornam DefectResponse, lista data[]/meta.pagination; criação 201/Location,
demais 200. JSON limitado a 32 KiB. Buscar por ID + Workspace + Project, inclusive
origem/filtros; 404 não revela outro escopo. Erros pt-BR/códigos estáveis e DTOs
explícitos; OpenAPI e front-specs na mesma entrega.

Migration aditiva: Defect/DefectAttachment, unique scope em RunCase, CHECKs
para enums/versão/sequência e tríade externa. Evoluir apenas CHECK de entity_type
no contador para TEST_CASE/DEFECT, preservando linhas/grants/snapshots anteriores.
UUIDs ASCII/binary, textos utf8mb4_0900_ai_ci; FKs compostas sem cascade.

## Verificação da entrega

- Node.js 24.15.0; typecheck, lint e build aprovados.
- 96 testes aprovados: 39 unitários/HTTP e 57 de integração com MySQL 8.4.11
  real via Testcontainers/Docker. Verifica banco vazio e upgrade da Fase 04,
  preservando plano, seleção, Run, cópias/passos, resultados, comentários,
  sequence de TestCase, roles de sistema e grants customizados anteriores.
- Defeitos: defaults/lista/filtros/paginação, sequência independente sob
  concorrência/rollback/exaustão, criação de falha com herança/overrides,
  preservação da execução, origem após alteração de resultado/archive da definição,
  estados/reabertura/auditoria/requestId, conflitos concorrentes com um vencedor,
  referência externa e tríade SQL, anexos privados e histórico após exclusão lógica,
  validação de DTO/query/payload e sessão, revogação e projeto arquivado.
- Testes de origem/defeito/arquivo entre Workspace/Project cobrem API e FKs
  compostas, incluindo ator com grants atuais insuficientes para execução/arquivo.
- OpenAPI exportado da aplicação contém 136 operações; 9 novas com todos os
  exemplos de requisição/sucesso/Problem Details conferidos contra schemas.
  Referências locais e JSON da documentação revisados. Contratos HTTP anteriores
  preservados; catálogo/matriz de grants ampliados explicitamente na documentação.
- Base configurada não foi migrada: testes usam schemas/containers descartáveis.
  Aplicar 202610020005_defects na implantação, depois das migrations anteriores.
  Biblioteca mantém storage privado existente; testes de arquivos usam storage
  fake e bytes reais via HTTP. Envio de e-mail segue mockado.
- Sem sincronização remota, requisitos/rastreabilidade ou governança. Alterações
  anteriores da Fase 04 preservadas; nenhum commit/publicação nesta entrega.
