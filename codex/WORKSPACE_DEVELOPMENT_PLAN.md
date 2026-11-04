# Planejamento do módulo Workspace

Registrado e revisado em **02/10/2026**. Estado: Fase 01 implementada;
contratos reais em [front-specs](../front-specs/README.md) e decisões em
[WORKSPACE_IMPLEMENTATION_DECISIONS.md](WORKSPACE_IMPLEMENTATION_DECISIONS.md).
Workspace é uma fase única, incluindo membros, convites, roles,
grupos, campos personalizados, tags e anexos. Shared parameters e Shared steps
foram retirados do escopo por decisão do usuário.

## Objetivo e interpretação da referência

Organizar equipes, acessos e recursos administrativos dentro de um Workspace,
reutilizando a identidade global já entregue. A primeira referência apresenta
Workspace; a segunda seleciona Shared parameters e Shared steps para exclusão.
Apontamento de horas/Worklog é uma funcionalidade distinta, sem entidade ou
contrato definido na documentação atual.

O print é uma referência de organização e interface. Não permite concluir as
regras internas do Qase, suas permissões ou o comportamento dos outros menus.
As propostas abaixo são decisões para o Lambda Quality, não afirmações sobre
a implementação do produto de referência.

## O que já existe no planejamento

| Menu do print     | Base no projeto                      | Direção proposta                                                                            |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Users             | WorkspaceMember ligado a User        | Fase 01: lista, pesquisa, filtros e gestão do vínculo                                       |
| Invites           | Invitation e aceite autenticado      | Fase 01: convite por e-mail, lista, reenvio, cancelamento e aceite                          |
| Groups            | Group, GroupMember e GroupRole       | Fase 01: organização e concessões por grupo                                                 |
| Roles             | Role, Permission e associações       | Fase 01: autorização e administração de roles                                               |
| Fields            | Sem modelo técnico definido          | Fase 01: definição/administração de campos; consumo pelos módulos nas fases correspondentes |
| Shared parameters | Sem modelo técnico definido          | Excluído do escopo, sem implementação planejada                                             |
| Shared steps      | Ideia inicial, sem contrato técnico  | Excluído do escopo, sem implementação planejada                                             |
| Tags              | Tag e TestCaseTag                    | Fase 01: catálogo do Workspace; vínculo com TestCase na Fase 03                             |
| Attachments       | Attachment, AttachmentLink e storage | Fase 01: biblioteca e acesso aos arquivos; vínculos nas fases dos módulos consumidores      |

Fontes: [mapa de domínio](DOMAIN_MODEL.md), [entidades](ENTITIES.md),
[casos de uso](USE_CASES.md), [API](API_SPEC.md),
[plano principal](CODEX_IMPLEMENTATION_PLAN.md) e
[visão inicial](Lambda_Quality_Ideias_Iniciais.md).

Hoje o código contém identidade, autenticação e saúde. As tabelas, rotas e
permissões de Workspace/RBAC ainda não foram implementadas. Este documento
detalha a nova Fase 01 do plano principal. A divisão anterior em Entregas A/B
foi substituída por uma entrega única, com revisão ao final da fase completa.

## Sequência acordada

1. Workspaces.
2. Projetos.
3. Casos de Teste.
4. Planos e Execuções.
5. Defeitos.
6. Governança.

Bootstrap e identidade são a base já entregue, fora da numeração acima.
Requisitos/rastreabilidade, automação e integrações permanecem no backlog
sem posição nesta sequência. Não foram excluídos do modelo conceitual.

## Mapa funcional

```text
User global (já implementado)
 └── WorkspaceMember: vínculo e status específicos de cada Workspace
      ├── Roles diretas → Permissions
      └── Groups → Roles → Permissions

Workspace
 ├── Dados e seleção do Workspace
 ├── Members: consulta e administração de vínculos
 ├── Invitations: entrada de novos membros por e-mail
 ├── Roles: catálogo e concessões do Workspace
 ├── Groups: organização dos membros e concessões coletivas
 ├── Custom fields: definições e administração
 ├── Tags: catálogo do Workspace
 ├── Attachments: biblioteca e operações de arquivo
 └── Auditoria das alterações administrativas

Integrações nas fases seguintes
 ├── Project → acesso por Workspace e escopo de projeto
 ├── TestCase → tags, valores de campos e anexos
 ├── TestRun → snapshots de campos e histórico
 └── Governance → vínculos de evidências e anexos
```

## Colunas da lista de membros

| Referência visual | Proposta para a API                                      | Regra                                                                               |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| User              | user.id, displayName e email no DTO do membro            | Consultar identidade por port público; nunca retornar senha, sessão ou tokens       |
| Status            | status de WorkspaceMember                                | Suspender/remover o vínculo afeta somente aquele Workspace                          |
| Type / Regular    | Adiar classificação Regular/Guest                        | Não existe diferença de acesso ou licença definida para esses tipos                 |
| Role              | roles diretas e herdadas, com origem; indicação de Owner | O modelo aceita várias roles, não somente uma coluna escalar                        |
| Role title        | jobTitle opcional no vínculo, como extensão futura       | Cargo profissional não é uma role de autorização; não alterar User global para isso |
| Last action       | lastActivityAt opcional, inicialmente adiado             | Quando entregue, usar ações relevantes auditadas naquele Workspace; UTC ou null     |

Busca por nome/e-mail; filtros por status, role e grupo na mesma fase,
sem duplicar membros na paginação.
Paginação segue API_SPEC: page/size, limite 100, ordenação permitida explícita
e desempate por ID. Datas relativas são apresentação do front-end.

## Fase 01 única — Workspaces

Os blocos abaixo são uma ordem interna de construção. Não representam fases
ou entregas separadas: o aceite inclui todos os blocos e a revisão ocorre ao
final do módulo completo.

### Fundação e autorização

- Criar, listar os Workspaces acessíveis, consultar e alterar dados básicos.
- Criação autenticada: Workspace, membro criador e concessões iniciais na
  mesma transação. Cadastro de User continua sem criar Workspace automático.
- Normalizar slug e definir sua unicidade antes da migration. Proposta:
  slug global único; acessos continuam por UUID e membership.
- Revalidar User/sessão, Workspace e membership em cada requisição.
- Entregar o catálogo de permissions, roles de sistema, CRUD de roles
  customizadas e grupos nesta fase. Não expor mutações com autorização
  apenas no front.
- Proposta inicial: Owner administra o Workspace; Administrator gerencia
  membros/convites; Member consulta o Workspace e sua lista de membros.
  Somente Owner transfere ownership. Regras de projetos virão na Fase 02.

### Gestão de membros

- Listar/consultar membros, com busca, filtros e paginação.
- Suspender e reativar o vínculo; remover preservando a identidade global
  e a auditoria. DELETE do membro não exclui User nem seus outros vínculos.
- Membro removido ou suspenso perde acesso na próxima requisição após commit,
  mesmo com JWT ainda válido. Não revogar sessões globais por essa operação.
- Proteger o Owner contra remoção/suspensão; exigir transferência primeiro.
- Reentrada de membro removido por novo convite reutiliza o vínculo único,
  limpa associações antigas de acesso e concede somente a role inicial.
  Convite não serve para contornar suspensão: reativação é administrativa.

### Convites via SendGrid

- Criar/listar convites; cancelar e reenviar com cooldown/rate limit.
- Destinatário já ativo não recebe vínculo duplicado. Proposta: conflito 409
  para membro ativo/suspenso ou convite pendente; reenvio usa ação específica.
- Token opaco aleatório, apenas hash persistido, validade configurável e uso
  único. Reenvio invalida o token anterior; cancelamento invalida o vigente.
- Aceite requer bearer, User ativo e e-mail confirmado igual ao destinatário.
  Criar conta continua usando o fluxo existente de código por e-mail.
- Aceitar cria/reativa membership e concede Member atomicamente. Nenhum
  convite público escolhe livremente permissões administrativas.
- Retry com o mesmo token, já aceito pelo mesmo usuário, pode retornar o
  vínculo existente sem nova mutação. Não aceita reuso por outro usuário,
  nem reativa um vínculo removido/suspenso depois do primeiro aceite.
- Token é enviado no body da API, sem logs/auditoria/resposta de listagem.
  Definir o transporte do link no front sem query de token na API.
- Reutilizar configuração/adapters de envio por contrato público, sem importar
  repositories internos de identity. O adapter atual de códigos não é, por
  si só, um template de convite pronto.
- Definir envio recuperável: transação grava convite e intenção de envio;
  falha de SendGrid não cria duplicatas nem reporta entrega confirmada.
  Se houver outbox com payload sensível, proteger o token, limitar retenção e
  removê-lo após processamento; token nunca fica em texto puro na Invitation.

### Auditoria mínima

Persistir criação/alteração de Workspace, convites, mudanças de membership
e alterações em roles, grupos, campos, tags e anexos
com workspaceId, ator, ação, entidade e requestId na transação correspondente.
Essa trilha de segurança acompanha a funcionalidade; consultas gerais de
auditoria e a coluna de última atividade continuam na evolução posterior.

### Roles, permissions e grupos

- Consultar catálogo de permissions; criar/consultar/alterar/remover roles
  customizadas e suas permissions, com proteção das roles de sistema.
- Atribuir/revogar roles diretamente em membros. Validar membro/role no
  mesmo Workspace e impedir concessão acima dos privilégios do administrador.
- Criar/consultar/alterar/remover grupos; adicionar/remover membros;
  atribuir/revogar roles em grupos, sempre no mesmo Workspace.
- Permissions efetivas são a união das concessões diretas e via grupos,
  calculadas do estado atual. Sem denies explícitos nesta primeira versão.
- Alterações entram em vigor na próxima requisição após commit; caches
  precisam preservar essa garantia. Não depender de roles no JWT.
- Remover uma role customizada com vínculos ativos retorna conflito; primeiro
  revogar as associações. Remover grupo remove suas concessões, não os membros.
- Owner não pode ser concedido por role customizada ou grupo. Mudanças de
  acesso e exclusões administrativas produzem auditoria tenant-scoped.

### Campos personalizados

- Criar, listar, consultar, alterar e arquivar definições no Workspace.
- Proposta inicial de tipos: TEXT, NUMBER, BOOLEAN, DATE e SINGLE_SELECT.
  Definir chave normalizada única por Workspace/alvo, nome, descrição,
  obrigatoriedade, opções quando aplicáveis e ordem de apresentação.
- O catálogo informa os alvos suportados pela API. Proposta inicial:
  TEST_CASE; cadastrar a definição não cria casos ou valores antes da Fase 03.
- Opções têm IDs estáveis; mudanças incompatíveis de tipo/chave/alvo ou
  exclusão de opções exigem regra explícita de versão e preservação de valores.
  Depois de publicada, mudança incompatível exige nova definição; arquivar
  preserva a antiga. Não converter dados existentes silenciosamente.
- Definições pertencem ao Workspace. Valores, validação em TestCase e seu
  snapshot em Run entram nas Fases 03/04, sem alterar execuções históricas.
- Registrar CustomFieldDefinition e o contrato proposto no modelo técnico
  antes de implementar; CustomFieldValue será acrescentado com seu consumidor.

### Tags

- Criar, listar, consultar, renomear e remover tags do catálogo do Workspace,
  com nome normalizado único no escopo e autorização própria.
- Nesta fase, tags são do Workspace. Tags com escopo de Project e associação
  TestCaseTag entram somente quando os recursos consumidores forem entregues.
- A remoção de tag utilizada deve ter política explícita antes desses vínculos;
  proposta: conflito 409 enquanto houver uso, sem destruir histórico.
- O módulo dono continua testmanagement, mesmo com administração no menu
  Workspace. Implementar o catálogo por port, sem acoplar repositories.

### Anexos

- Entregar upload, biblioteca paginada, metadados, download autorizado e
  exclusão lógica no Workspace, com permission de leitura definida.
- Escolher/configurar backend de storage antes da implementação. Usar port
  independente do provedor; adapter local pode atender desenvolvimento/testes.
- Validar tamanho e tipos permitidos, nome original, checksum e storage key
  aleatória; nenhum caminho fornecido pelo cliente controla o filesystem.
- Não oferecer arquivos por URL pública previsível. Download valida sessão,
  Workspace, vínculo e permission; stream respeita o contrato de API_SPEC.
- Persistir metadados e auditar operações. Tratar falha entre storage/banco
  com compensação e limpeza de arquivos órfãos; definir retenção/exclusão física.
- AttachmentLink para TestCase, Defect e evidências será entregue com os
  consumidores. Validar o destino por Workspace e Project quando aplicável.
  Sem vínculos para tipos de recurso ainda indisponíveis.

**Aceite único da Fase 01:** todos os blocos acima funcionam; dois Workspaces
isolados; usuário com múltiplos vínculos; convites e reenvios com falhas/retries;
revogação efetiva; transferência concorrente sem perda de Owner; matriz de
permissions diretas/herdadas e prevenção de escalada; constraints cross-tenant;
catálogos de campos/tags e biblioteca de anexos protegidos; migrations e
integração MySQL; Swagger e front-specs completos para os endpoints entregues.

## Contratos HTTP entregues

Todos os caminhos abaixo foram **implementados**, relativos a `/api/v1`, e
estão disponíveis no Swagger atual. DTOs, limites, permissões e erros reais
estão nos guias do front-end e OpenAPI. A entrega também inclui consulta
individual `GET /workspaces/{workspaceId}/invitations/{invitationId}`.

| Área da fase única | Método e caminho                                                         | Finalidade                                                                |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Workspace          | POST /workspaces; GET /workspaces                                        | Criar e listar Workspaces acessíveis                                      |
| Workspace          | GET/PATCH /workspaces/{workspaceId}                                      | Consultar e alterar dados básicos                                         |
| Membros            | GET /workspaces/{workspaceId}/members                                    | Lista, busca e filtros                                                    |
| Membros            | GET/PATCH/DELETE /workspaces/{workspaceId}/members/{memberId}            | Consulta, mudança de status e remoção do vínculo                          |
| Convites           | GET/POST /workspaces/{workspaceId}/invitations                           | Consultar e criar convites                                                |
| Convites           | POST /workspaces/{workspaceId}/invitations/{invitationId}/resend         | Reenviar e invalidar token anterior                                       |
| Convites           | DELETE /workspaces/{workspaceId}/invitations/{invitationId}              | Cancelar convite pendente                                                 |
| Convites           | POST /invitations/accept                                                 | Aceitar convite; token no body                                            |
| Workspace          | POST /workspaces/{workspaceId}/ownership/transfer                        | Transferir para membro ativo do mesmo Workspace                           |
| Roles              | GET /permissions                                                         | Catálogo público ao usuário autenticado, sem concessões de outros tenants |
| Roles              | GET/POST /workspaces/{workspaceId}/roles                                 | Listar e criar roles                                                      |
| Roles              | GET/PATCH/DELETE /workspaces/{workspaceId}/roles/{roleId}                | Administrar role customizada                                              |
| Roles              | PUT/DELETE /workspaces/{workspaceId}/members/{memberId}/roles/{roleId}   | Atribuir/revogar role direta de forma idempotente                         |
| Grupos             | GET/POST /workspaces/{workspaceId}/groups                                | Listar e criar grupos                                                     |
| Grupos             | GET/PATCH/DELETE /workspaces/{workspaceId}/groups/{groupId}              | Administrar grupo                                                         |
| Grupos             | GET /workspaces/{workspaceId}/groups/{groupId}/members                   | Consultar participantes                                                   |
| Grupos             | PUT/DELETE /workspaces/{workspaceId}/groups/{groupId}/members/{memberId} | Adicionar/remover participante de forma idempotente                       |
| Grupos             | PUT/DELETE /workspaces/{workspaceId}/groups/{groupId}/roles/{roleId}     | Atribuir/revogar role coletiva de forma idempotente                       |
| Campos             | GET/POST /workspaces/{workspaceId}/custom-fields                         | Listar/criar definições                                                   |
| Campos             | GET/PATCH /workspaces/{workspaceId}/custom-fields/{fieldId}              | Consultar/alterar definição                                               |
| Campos             | POST /workspaces/{workspaceId}/custom-fields/{fieldId}/archive           | Arquivar preservando a definição                                          |
| Tags               | GET/POST /workspaces/{workspaceId}/tags                                  | Listar/criar tags do Workspace                                            |
| Tags               | GET/PATCH/DELETE /workspaces/{workspaceId}/tags/{tagId}                  | Consultar/renomear/remover tag                                            |
| Anexos             | GET/POST /workspaces/{workspaceId}/attachments                           | Biblioteca e upload multipart                                             |
| Anexos             | GET/DELETE /workspaces/{workspaceId}/attachments/{attachmentId}          | Metadados e exclusão lógica                                               |
| Anexos             | GET /workspaces/{workspaceId}/attachments/{attachmentId}/download        | Download autorizado sem envelope JSON                                     |

Sucesso e erros seguem API_SPEC, com mensagens pt-BR. Autenticação inválida
retorna 401; tenant/recurso não visível, 404; operação proibida no escopo
visível, 403; conflito de regra, 409; validação, 400; excesso de tentativas, 429. Definir códigos estáveis para convite expirado/cancelado, vínculo já
existente, Owner protegido e role vinculada antes de publicar os endpoints.

## Decisões propostas que precisam entrar no modelo técnico

As recomendações abaixo foram consolidadas nas decisões de implementação,
ENTITIES e DATABASE_MODEL. Cargo/tipo e coluna de última ação permanecem
fora da entrega. O quadro preserva o contexto da decisão inicial.

| Ponto                         | Recomendação                                                                                                                                            | Momento                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ownership                     | Um Owner por Workspace, via novo ownerMemberId apontando para membro do mesmo tenant; rótulo Owner derivado desse vínculo, separado das roles editáveis | Antes da migration; criação/transferência atômicas e bloqueio do Workspace para concorrência |
| Roles iniciais                | Administrator e Member como roles de sistema imutáveis; catálogo entregue junto ao Workspace                                                            | Fase 01 única, com roles customizadas e grupos                                               |
| Granularidade das permissions | Preservar workspace.read/manage_members/manage_roles; definir alteração de Workspace, gestão de grupos/campos/tags e leitura de anexos                  | Consolidar a matriz completa da Fase 01 antes de expor suas rotas                            |
| Status de convite             | PENDING, ACCEPTED e CANCELED; EXPIRED calculado por expiresAt no DTO                                                                                    | Fase 01, incluindo comportamento de reenvio e retries                                        |
| Status do vínculo             | Entrada pendente representada por Invitation; membership nasce ACTIVE no aceite; INVITED não é necessário no fluxo inicial                              | Fase 01; manter compatibilidade com enums existentes                                         |
| Cargo/tipo de usuário         | Adiar jobTitle e Regular/Guest até haver regra de produto                                                                                               | Extensão posterior; não inventar enum sem semântica                                          |
| Última ação                   | Ações auditadas do ator naquele Workspace; null sem histórico; não usar último login global                                                             | Antes de entregar essa coluna                                                                |
| Campos                        | Novo CustomFieldDefinition; definir tipos/alvos, unicidade, opções e mudanças incompatíveis                                                             | Catálogo na Fase 01; valores e snapshots nas Fases 03/04                                     |
| Tags/anexos                   | Administração no Workspace preserva os módulos donos; dependências de Project e vínculos são acrescentados com os consumidores                          | Biblioteca/catálogo na Fase 01; integrações posteriores                                      |

Shared parameters e Shared steps estão excluídos, não apenas adiados.
Isso não remove TestStep: cada caso continua tendo seus próprios passos.
Não criar entidades, endpoints, migrations ou menus para os dois recursos
excluídos. Snapshots de TestRunCase/TestRunStep continuam obrigatórios.

## Fluxo esperado para o front-end

```text
Login → listar Workspaces acessíveis
        ├── lista vazia → criar Workspace ou aceitar convite
        └── selecionar Workspace → membros e operações autorizadas

Administrador → criar convite → e-mail
Destinatário → cadastrar-se por código (se necessário) → login → aceitar
             → Workspace disponível na lista → acesso conforme permissions

Owner → roles/grupos → conceder/revogar acesso → próxima requisição atualizada
```

Trocar Workspace limpa dados/cache do escopo anterior. A UI trata lista vazia,
loading, validações por campo, convite inválido/expirado e falta de acesso.
Menus futuros podem ficar ocultos até a entrega correspondente. Capacidades
retornadas pela API ajudam a apresentação, mas o backend sempre autoriza.

A fase cria/atualiza `front-specs/workspaces.md` e os guias de acesso,
campos personalizados, tags e anexos conforme a organização por funcionalidade,
usando o
[template de endpoint](../front-specs/ENDPOINT_TEMPLATE.md) e atualizando o
[índice](../front-specs/README.md). Os guias e OpenAPI documentam somente os
endpoints efetivamente entregues, incluindo impactos de compatibilidade.

## Verificação e sequência de execução

1. Consolidar decisões da fase única em domínio, entidades, banco, segurança,
   casos de uso e API; implementar todo o escopo de Workspaces quando solicitado.
2. Migration versionada; domínio independente de NestJS/Prisma; ports entre
   workspace/identity; use cases transacionais; DTOs e autorização HTTP.
3. Testes unitários/HTTP e integração com MySQL real: isolamento inclusive
   contagens/filtros, sessão válida sem membership, remoção mantendo outro
   Workspace acessível, reenvio/aceite concorrentes, falha de e-mail,
   transferência de Owner concorrente, proteção contra escalada, catálogos
   isolados e upload/download/exclusão de anexos com falhas de storage.
4. Verificar upgrade da migration de identidade e banco vazio; executar lint,
   tipos, build e testes relevantes; manter Swagger/front-specs consistentes.
5. Apresentar resultados da fase completa e parar para revisão. Continuar
   com Projetos, Casos de Teste, Planos e Execuções, Defeitos e Governança
   conforme a sequência acordada e o escopo solicitado.

Este planejamento não aplica migrations, altera `.env`, envia e-mails ou
modifica endpoints. Estimativas de prazo dependem das decisões de produto e
do tamanho de cada entrega; o print sozinho não define uma reprodução completa.
