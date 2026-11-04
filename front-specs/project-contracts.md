# Contratos e integração de Projetos

Fase 02, API v1, 02/10/2026. Base /api/v1; JSON UTF-8, UUID v4, timestamps com offset -03:00
e datas de calendário YYYY-MM-DD. [Guia por endpoint](projects.md).

## Fluxo

Login → selecionar Workspace → GET /workspaces/{workspaceId}/projects
→ criar/selecionar projeto → participantes, marcos e ambientes.
Lista padrão mostra ACTIVE; use status=ARCHIVED/ALL para histórico.
Use key como identificador humano (normalizada uppercase); URLs usam id UUID.
Key é única por Workspace, imutável e reservada após archive.

Cache precisa incluir workspaceId e projectId; trocar escopo limpa dados do
anterior. Tokens permanecem em memória, conforme [autenticação](authentication.md).
Ocultar ação usando permissions do projeto ajuda a UI; backend revalida cada
requisição. 404 de tenant/projeto não exige logout global.

## Acesso

Permission do Workspace **e** capability local são necessárias.

| Role local | Capabilities possíveis (dependem das permissions do Workspace)                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| VIEWER     | project.read, testcase.read, testrun.read, defect.read                                                                                    |
| EDITOR     | project.read, project.update, milestone.manage, environment.manage, testcase.read/create/update, testrun.read/execute, defect.read/manage |
| MANAGER    | As de EDITOR + project.archive, project.manage_members, testcase.archive, testrun.manage                                                  |

Owner/Administrator possuem as novas permissions, inclusive project.manage_all.
manage_all permite enxergar todos os projetos, sem exigir ProjectMember;
continua exigindo permission específica de leitura/escrita. Member ganha apenas
project.read e precisa de vínculo local. Roles customizadas não são ampliadas
pela migration; administrator pode acrescentar permissions explicitamente.

Exemplo: Member + MANAGER continua apenas lendo. Para permitir edição, atribuir
role de Workspace com project.update; para gerir marcos, milestone.manage.
Criar projeto exige project.create e atribui MANAGER ao criador, sem conceder
permissions novas no Workspace. Projetos visíveis retornam permissions efetivas
e projectRole (null quando administrador não possui vínculo local).

Administrar participantes exige project.manage_members e capability MANAGER
(ou manage_all); atribuição não pode superar capabilities atuais do ator.
workspaceMemberId vem da API de membros do Workspace, nunca usar User.id.
Suspensão interrompe acesso e mantém vínculo para reativação. Remoção do
Workspace limpa vínculos de projetos; reentrada por convite não os recupera.

## Arquivamento e exclusões

Archive preserva tudo, bloqueia mutações e não oferece restore nesta fase.
Repetir archive é 200 e mantém archivedAt. Marcos concluídos não são reescritos;
complete é idempotente e mantém completedAt. CANCELLED não conclui diretamente;
PATCH pode voltar para PLANNED/IN_PROGRESS.
DELETE de marco/ambiente é lógico, idempotente e passa a ocultar o recurso.
Ambiente excluído fica inativo e seu nome continua reservado. active=false
apenas desativa, permitindo consulta/edição posterior enquanto projeto ACTIVE.
Não há DELETE de Project. Runs da Fase 04 preservam snapshots de contexto,
mesmo após renomear/excluir logicamente marcos/ambientes. Projeto arquivado
bloqueia inclusive resultados, comentários e abort de Runs; consulta permanece disponível.

## Paginação e erros

Listas: data array + meta.pagination (page,size,totalItems,totalPages,hasNext,hasPrevious).
page padrão 1 (máximo 100000), size padrão 20 (máximo 100). sort campo,asc/desc
com campos permitidos por endpoint; desempate por id. Lista vazia é 200, data=[],
totalItems/totalPages=0. Contagens consideram escopo antes da paginação.
GET details não aceita query; mutações não aceitam query nem campos extras.
Dates/description opcionais permitem null; name/active/status/roles recusam null.

200/201 JSON usa data/message/meta; 201 fornece Location. 204 não tem corpo.
Todas as respostas autenticadas deste módulo usam Cache-Control: no-store.
Erros: application/problem+json com code/HTTP/errors/requestId. Desde
08/10/2026, operações autenticadas de projetos não têm quota geral de requisições.
Não comparar texto das mensagens nem repetir mutações cegamente após timeout.
Leia [convenções de Workspace](workspace-contracts.md) e [authentication.md](authentication.md).

## Compatibilidade da Fase 01

GET /permissions acrescenta oito códigos, totalizando 20. Owner/Administrator
acompanham o catálogo; Member acrescenta project.read; roles customizadas
permanecem intactas. WorkspaceResponse.permissions e permissionCodes de
roles podem conter os novos códigos. Convites/identidade não mudam payload.
Campos/tags/anexos continuam tenant-wide, sem projectId ou links novos.

## Modelos de resposta

## ProjectResponse

| Campo       | Tipo/formato | Obrigatório | Regras                                                      |
| ----------- | ------------ | ----------- | ----------------------------------------------------------- |
| id          | uuid         | sim         | Conforme o endpoint.                                        |
| workspaceId | uuid         | sim         | Conforme o endpoint.                                        |
| key         | string       | sim         | Conforme o endpoint.                                        |
| name        | string       | sim         | Conforme o endpoint.                                        |
| description | string       | sim         | Aceita null.                                                |
| status      | string       | sim         | Valores: ACTIVE, ARCHIVED.                                  |
| createdAt   | date-time    | sim         | Conforme o endpoint.                                        |
| updatedAt   | date-time    | sim         | Conforme o endpoint.                                        |
| archivedAt  | date-time    | sim         | Aceita null.                                                |
| projectRole | string       | sim         | Aceita null. Valores: VIEWER, EDITOR, MANAGER.              |
| permissions | string[]     | sim         | Permissions efetivas no projeto, para UI; backend revalida. |

## ProjectMemberListResponse

| Campo                 | Tipo/formato          | Obrigatório | Regras                            |
| --------------------- | --------------------- | ----------- | --------------------------------- |
| id                    | uuid                  | sim         | Conforme o endpoint.              |
| workspaceId           | uuid                  | sim         | Conforme o endpoint.              |
| projectId             | uuid                  | sim         | Conforme o endpoint.              |
| workspaceMemberId     | uuid                  | sim         | Conforme o endpoint.              |
| projectRole           | string                | sim         | Valores: VIEWER, EDITOR, MANAGER. |
| createdAt             | date-time             | sim         | Conforme o endpoint.              |
| updatedAt             | date-time             | sim         | Conforme o endpoint.              |
| workspaceMemberStatus | string                | sim         | Valores: ACTIVE, SUSPENDED.       |
| user                  | DirectoryUserResponse | sim         | Conforme o endpoint.              |

## DirectoryUserResponse

| Campo           | Tipo/formato | Obrigatório | Regras                      |
| --------------- | ------------ | ----------- | --------------------------- |
| id              | uuid         | sim         | Conforme o endpoint.        |
| email           | email        | sim         | Conforme o endpoint.        |
| displayName     | string       | sim         | Conforme o endpoint.        |
| status          | string       | sim         | Valores: ACTIVE, SUSPENDED. |
| emailVerifiedAt | date-time    | sim         | Conforme o endpoint.        |

## ProjectMemberResponse

| Campo             | Tipo/formato | Obrigatório | Regras                            |
| ----------------- | ------------ | ----------- | --------------------------------- |
| id                | uuid         | sim         | Conforme o endpoint.              |
| workspaceId       | uuid         | sim         | Conforme o endpoint.              |
| projectId         | uuid         | sim         | Conforme o endpoint.              |
| workspaceMemberId | uuid         | sim         | Conforme o endpoint.              |
| projectRole       | string       | sim         | Valores: VIEWER, EDITOR, MANAGER. |
| createdAt         | date-time    | sim         | Conforme o endpoint.              |
| updatedAt         | date-time    | sim         | Conforme o endpoint.              |

## MilestoneResponse

| Campo       | Tipo/formato | Obrigatório | Regras                                               |
| ----------- | ------------ | ----------- | ---------------------------------------------------- |
| id          | uuid         | sim         | Conforme o endpoint.                                 |
| workspaceId | uuid         | sim         | Conforme o endpoint.                                 |
| projectId   | uuid         | sim         | Conforme o endpoint.                                 |
| name        | string       | sim         | Conforme o endpoint.                                 |
| description | string       | sim         | Aceita null.                                         |
| status      | string       | sim         | Valores: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED. |
| startDate   | date         | sim         | Aceita null.                                         |
| dueDate     | date         | sim         | Aceita null.                                         |
| completedAt | date-time    | sim         | Aceita null.                                         |
| createdAt   | date-time    | sim         | Conforme o endpoint.                                 |
| updatedAt   | date-time    | sim         | Conforme o endpoint.                                 |
| deletedAt   | date-time    | sim         | Aceita null.                                         |

## EnvironmentResponse

| Campo       | Tipo/formato | Obrigatório | Regras               |
| ----------- | ------------ | ----------- | -------------------- |
| id          | uuid         | sim         | Conforme o endpoint. |
| workspaceId | uuid         | sim         | Conforme o endpoint. |
| projectId   | uuid         | sim         | Conforme o endpoint. |
| name        | string       | sim         | Conforme o endpoint. |
| description | string       | sim         | Aceita null.         |
| active      | boolean      | sim         | Conforme o endpoint. |
| createdAt   | date-time    | sim         | Conforme o endpoint. |
| updatedAt   | date-time    | sim         | Conforme o endpoint. |
| deletedAt   | date-time    | sim         | Aceita null.         |

## Evolução da Fase 03

[Casos de Teste](test-case-contracts.md) amplia capabilities conforme a matriz
acima. Catálogo na Fase 03 continha 24 permissions. Member recebe testcase.read;
Administrator recebe as quatro. Atribuição local continua limitada pelo ator,
incluindo testcase.*; revisar grants customizados antes de atribuir EDITOR/MANAGER.

## Evolução da Fase 04

[Planos e Execuções](execution-contracts.md) acrescenta testrun.read/execute/manage,
conforme matriz acima; catálogo na Fase 04 continha 27 permissions. Member recebe read,
Administrator as três e grants customizados são preservados. Atribuir EDITOR/MANAGER
exige também as capabilities de testrun da role, sem conceder grants de Workspace.
ProjectResponse.permissions pode conter os novos códigos. Refresh de listas de
permissions/roles/projetos após migration; payloads antigos permanecem válidos.

## Evolução da Fase 05

[Defeitos](defect-contracts.md) acrescenta defect.read para VIEWER e read/manage
para EDITOR/MANAGER; catálogo atual com 32 permissions. Member recebe read;
Administrator ambas, grants customizados intactos. Atribuição de role local
agora verifica também defect.*; ajustar grants administrativos customizados.
ProjectResponse.permissions inclui novos códigos quando efetivos. Projeto
arquivado bloqueia criação/estado/vínculos de defeitos e preserva leitura.
