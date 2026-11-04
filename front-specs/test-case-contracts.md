# Contratos de Casos de Teste

Fase 03, API v1, atualizado em 03/10/2026. [26 endpoints](test-cases.md) e
[decisões técnicas](../codex/TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md).
Base: /api/v1/workspaces/{workspaceId}/projects/{projectId}.

## Acesso e fluxo

Login → selecionar Workspace/Projeto → carregar permissões e catálogos
→ listar suítes/casos → criar/editar caso com passos e valores → arquivar/restaurar.

| Role local | Capabilities adicionais (intersectar grants do Workspace) |
| ---------- | --------------------------------------------------------- |
| VIEWER     | testcase.read                                             |
| EDITOR     | testcase.read, testcase.create, testcase.update           |
| MANAGER    | As de EDITOR + testcase.archive                           |

Owner/Administrator possuem as quatro novas permissions. Member recebe
somente testcase.read, ainda exigindo vínculo local. Roles customizadas
exigem grants explícitos. project.manage_all dispensa vínculo local;
continua exigindo a permission específica. Clone exige read+create.
Vínculos de anexo e create/clone com anexos exigem attachment.read.
Tags e campos são associáveis com permissions de testcase; consultar seus
catálogos completos exige tag.read/field.read. Metadados e bytes de arquivos
continuam nos endpoints de Workspace com attachment.read.

IDs externos/fora do projeto são 404; operação sem permission em projeto
visível é 403. Toda mutação bloqueia Project ARCHIVED.

## Entradas de casos

| Campo                                    | Tipo                                                                           | Criação               | PATCH                              |
| ---------------------------------------- | ------------------------------------------------------------------------------ | --------------------- | ---------------------------------- |
| title                                    | texto trim 1–250                                                               | Obrigatório           | Opcional; null proibido            |
| description/preconditions/postconditions | texto até 10000 ou null                                                        | Default null          | Ausente preserva; null limpa       |
| severity                                 | TRIVIAL/MINOR/NORMAL/MAJOR/CRITICAL/BLOCKER                                    | NORMAL                | Opcional                           |
| priority                                 | LOW/MEDIUM/HIGH/URGENT                                                         | MEDIUM                | Opcional                           |
| status                                   | DRAFT/ACTIVE/DEPRECATED                                                        | DRAFT                 | Opcional; ARCHIVED só pelo comando |
| type                                     | FUNCTIONAL/REGRESSION/SMOKE/SANITY/PERFORMANCE/SECURITY/USABILITY/OTHER        | FUNCTIONAL            | Opcional                           |
| layer                                    | E2E/API/INTEGRATION/UNIT/COMPONENT/OTHER                                       | E2E                   | Opcional                           |
| behavior                                 | texto até 100 ou null                                                          | null                  | Opcional/nulo; sem enum            |
| automationStatus                         | MANUAL/TO_BE_AUTOMATED/IN_PROGRESS/AUTOMATED/NOT_APPLICABLE                    | MANUAL                | Opcional                           |
| suiteId                                  | UUID v4 ativo no projeto ou null                                               | null                  | Usar /move                         |
| steps                                    | array até 1000, action trim 1–10000; testData/expectedResult até 10000 ou null | []                    | Endpoints próprios                 |
| tagIds/attachmentIds                     | arrays UUID v4 até 1000 sem duplicatas                                         | []                    | PUT/DELETE de vínculos             |
| customFields                             | array até 1000 {fieldId,value} sem duplicatas                                  | [] e validar required | Merge; PUT substitui ativos        |
| version                                  | inteiro 1–2147483647                                                           | Gerada em 1           | Obrigatória                        |

Não enviar IDs, humanId, sequence, createdBy, timestamps ou campos extras.
Enums opcionais recusam null. Body JSON limitado a 32 KiB em toda a aplicação;
os limites por campo/array não autorizam exceder o limite total.

## Valores personalizados

fieldId é UUID da definição do Workspace, target TEST_CASE, ativa.
TEXT: string até 10000; NUMBER: número finito sem coerção; BOOLEAN: boolean;
DATE: string YYYY-MM-DD com dia real entre 1000–9999; SINGLE_SELECT: UUID da
opção (não label). value=null remove. Zero e false preenchem required.
Texto vazio/branco não preenche required. Objetos/arrays não são valores.

Create/PATCH/restore/clone/PUT verificam todos os obrigatórios ativos.
PATCH permite enviar customFields para complementar os atuais. PUT substitui
somente ativos; arquivados são preservados e retornados. Definições arquivadas
não aceitam novas escritas. Novo obrigatório não preenche automaticamente
casos antigos; a próxima edição/restauração exige preenchimento.
Clone só copia valores de definições ativas e rejeita obrigatório ausente.

## Version, ordenação e histórico

Guarde version retornada e envie nas mutações do caso, passos e vínculos.
TEST_CASE_VERSION_CONFLICT (409) significa edição concorrente: recarregue,
compare e reconcilie antes de tentar novamente. Não repita com versão nova
sem revisar a alteração de outro usuário. Mutações incrementam version;
vínculos e archive repetidos sem efeito mantêm version (se a enviada é atual).

Suítes usam posição base 1 entre irmãos ativos; parentSuiteId=null é raiz.
Listagem plana é paginada: percorra todas as páginas para reconstruir árvore.
Reorder usa todos os IDs atuais, sem duplicatas. Suíte não pode entrar em
si/descendente. ArchiveSuite exige ausência de filhos/casos não arquivados;
arquivamento não recorre. Não há restore de suíte.

Passos próprios têm posição base 1 e até 1000 por caso. Reorder preserva IDs.
Sequence é imutável; humanId combina Project.key e sequence. Move case muda
apenas suiteId. Archive mantém definição/passos/valores/vínculos; consulta
continua disponível. Restore recebe estado explícito e pode escolher nova
suíte/root. Clone de arquivado é possível, desde que destino e campos atuais
sejam válidos; nasce DRAFT. Arquivos são referências, sem cópia de bytes.

Tag em uso (inclusive por arquivado) impede DELETE do catálogo com TAG_IN_USE.
Arquivo excluído logicamente mantém vínculo histórico, mas deixa de aparecer
em attachmentIds; não admite nova associação. Runs/snapshots estão disponíveis
na Fase 04; operações de definição não alteram execuções existentes.

## Contagens do repositório

GET `.../test-cases/summary` (`getTestCaseSummary`) exige `testcase.read`
efetiva e os mesmos escopos da listagem, inclusive em projeto arquivado.
Recebe somente `status` opcional DRAFT/ACTIVE/DEPRECATED/ARCHIVED/ALL; ausente
exclui arquivados. Retorna `{totalCases, suites: [{suiteId, totalCases}]}`
no envelope normal, sem paginação. suiteId null conta casos sem suíte; demais
UUIDs contam associações diretas. Grupos vazios são omitidos; inventário vazio
é `{totalCases: 0, suites: []}`. Inteiros não negativos; somar descendentes
somente no front, sem duplicar grupos. Busca e seleção de suíte não mudam
as contagens do inventário. Não carrega definições, passos ou vínculos.
[Contrato completo e transição do fallback](test-cases.md#get-apiv1workspacesworkspaceidprojectsprojectidtest-casessummary).
Nova rota aditiva em 03/10/2026, sem migration; recarregar o front depois
de atualizar o servidor para detectar sua disponibilidade.

## Modelos de resposta

Todos os campos abaixo são obrigatórios no JSON, inclusive os nulos.

| Modelo        | Campos                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SuiteResponse | id/workspaceId/projectId UUID; parentSuiteId UUID ou null; name string; description string ou null; position inteiro; createdAt/updatedAt com offset -03:00; archivedAt com offset -03:00 ou null                                                                                                                                                            |
| CaseResponse  | id/workspaceId/projectId/createdBy UUID; suiteId UUID ou null; sequence/version inteiros; humanId string; title e definição conforme tabela de entrada (status inclui ARCHIVED); createdAt/updatedAt com offset -03:00; archivedAt com offset -03:00 ou null; steps StepResponse[]; tagIds/attachmentIds UUID[]; customFields {fieldId UUID,value escalar}[] |
| StepResponse  | id/workspaceId/projectId/testCaseId UUID; position inteiro; action string; testData/expectedResult string ou null                                                                                                                                                                                                                |

Listas de casos retornam o agregado completo. Tags/anexos retornam IDs;
metadados são carregados nos catálogos/biblioteca com a permission adequada.
Timestamps ISO 8601 com offset -03:00 (persistência UTC). Sucesso data/message/meta, requestId coincide
com X-Request-Id; listas paginadas têm meta.pagination; arrays de passos e
ordenação de suítes não são paginados. Cache-Control: no-store.

## Compatibilidade

Catálogo GET /permissions passa de 20 para 24 códigos. Workspace/Role
permissionCodes e ProjectResponse.permissions incluem testcase.* quando
permitidos. Roles de sistema evoluem; grants customizados são preservados.
Atribuir ProjectMember exige que o ator tenha as capabilities da role,
incluindo testcase.*; ajustar grants administrativos customizados quando
necessário. Convites/identidade e payload de arquivos não mudam.

DELETE de Tag pode retornar 409 TAG_IN_USE. Todos os guias afetados registram
esses impactos. Migração 202610020003_test_management é aditiva e deve ser
aplicada antes de executar esta versão da API.

## Evolução da Fase 04

[Planos e Execuções](execution-contracts.md) está disponível. Criação de Run
exige ACTIVE e campos obrigatórios atuais; snapshots de caso, passos, tags e
campos/valores permanecem iguais após alteração, remoção de passo ou archive
na definição. Planos ACTIVE guardam seleção, copiam a definição atual apenas
na criação de cada Run. Na Fase 04 o catálogo passou a 27 permissions; testcase.* mantém
seus contratos. testrun.* amplia a matriz para atribuir roles locais.

## Evolução da Fase 05

[Defeitos](defect-contracts.md) vincula origens a cópias FAILED de execução,
sem editar TestCase. Catálogo atual com 35 permissions; matriz e atribuição
local incluem defect.* além de testcase/testrun, conforme [Projetos](project-contracts.md).
