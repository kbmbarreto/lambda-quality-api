# Fluxo e contratos de Workspaces

Disponibilidade: Fase 01 implementada, 02/10/2026. Base /api/v1; mensagens pt-BR;
IDs UUID v4; JSON UTF-8; timestamps com offset -03:00 ISO 8601 com Z.

## Fluxo de integração

1. Reutilizar [autenticação](authentication.md); tokens ficam em memória.
2. GET /workspaces; se vazio, permitir criar Workspace ou aceitar convite.
3. Selecionar Workspace pelo id; GET do Workspace fornece memberId/isOwner/permissions.
4. Abrir membros, convites, roles/grupos, campos, tags e biblioteca conforme permissions.
5. Trocar Workspace limpa os dados do anterior; chaves de cache incluem workspaceId.
6. Após alterações de acesso, recarregar capacidades. 403/404 de tenant não exige logout global.

Owner é isOwner/ownerMemberId, separado das roles editáveis. Pode haver várias
roles diretas e herdadas por membro. A união concede acesso; sem denies explícitos.
Cargo, Regular/Guest e última atividade não estão disponíveis nesta entrega.

Shared parameters/Shared steps foram excluídos. Valores de campos, vínculos de
TestCase e snapshots serão entregues com os respectivos consumidores.

## Convites

E-mail de convite usa token opaco, diferente do código de cadastro/reset.
Se INVITATION_ACCEPT_URL estiver configurada, o link usa #token=; ler e remover
o fragmento do histórico e manter o token em memória. Após cadastro/login com
o mesmo e-mail, POST /invitations/accept. Se houver reload e perder o token,
reabrir o link recebido. Não colocar token na query/rota da API ou logs/analytics.

202 confirma convite persistido; deliveryStatus SENT indica aceite pelo provedor,
sem garantia de entrega. FAILED fica recuperável: worker tenta novamente com
backoff até cinco tentativas; administrador também pode reenviar após cooldown.
Reenvio gera novo token e invalida o anterior; o prazo padrão é 48 horas.
Expiração/cancelamento/aceite encerram envio pendente.

## Anexos no navegador

Upload usa FormData; não definir Content-Type manualmente:

```javascript
const form = new FormData();
form.append('file', file);
const response = await fetch(`/api/v1/workspaces/${workspaceId}/attachments`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: form,
});
const result = await response.json(); // sucesso ou Problem Details
```

Download envia bearer por fetch, testa response.ok antes de converter para Blob
e usa URL.createObjectURL apenas no navegador. RevokeObjectURL após uso.
Não existe URL pública permanente. Content-Disposition exposto por CORS fornece
o nome; Content-Type representa bytes. Erros são application/problem+json.

Limite padrão 10 MiB (configurável), um arquivo PNG/JPEG/PDF/TXT/CSV UTF-8,
sem campos multipart extras. Não enviar HTML/SVG/executável. Exclusão revoga
acesso imediatamente; limpeza física após retenção padrão 30 dias é operação
do backend e não concede acesso a arquivo excluído.

## Envelopes e paginação

200/201/202 retornam data/message/meta; 204 não tem corpo. Listagens retornam
data como array e meta.pagination: page, size, totalItems, totalPages, hasNext,
hasPrevious. Página vazia é 200. page inicia em 1 (máximo 100000); size padrão
20, máximo 100. sort é campo,asc/desc, com allowlist por endpoint e desempate por ID.
Respostas do módulo usam Cache-Control: no-store. Uma lista vazia retorna:

```json
{
  "data": [],
  "message": "Workspaces consultados com sucesso.",
  "meta": {
    "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "timestamp": "2026-10-02T09:00:00.000-03:00",
    "pagination": {
      "page": 1,
      "size": 20,
      "totalItems": 0,
      "totalPages": 0,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

Campos extras são rejeitados; PATCH diferencia ausente de null. Somente
description aceita null nos DTOs opcionais desta fase; name/slug/required/position
null são recusados. Datas relativas são apresentação do front.

## Permissions

GET /permissions retorna catálogo, não as concessões do usuário. Owner possui
todas as permissions; Administrator recebe o catálogo inteiro e não transfere
ownership. Member recebe workspace.read, field.read, tag.read, attachment.read
e project.read, testcase.read, testrun.read e defect.read. O acesso a projetos segue a
[matriz da Fase 02](project-contracts.md#acesso).
Papéis de sistema são imutáveis. Não confiar em role no JWT nem em controles da UI
para autorizar; o backend revalida membership e permissions na requisição.

| Código                   | Finalidade                                                      |
| ------------------------ | --------------------------------------------------------------- |
| workspace.read           | Consultar Workspace, membros, roles e grupos.                   |
| workspace.update         | Alterar dados do Workspace.                                     |
| workspace.manage_members | Administrar membros e convites.                                 |
| workspace.manage_roles   | Administrar roles e concessões diretas.                         |
| workspace.manage_groups  | Administrar grupos e concessões coletivas.                      |
| field.read               | Consultar campos personalizados.                                |
| field.manage             | Administrar campos personalizados.                              |
| tag.read                 | Consultar tags.                                                 |
| tag.manage               | Administrar tags.                                               |
| attachment.read          | Consultar e baixar anexos.                                      |
| attachment.upload        | Enviar anexos.                                                  |
| attachment.delete        | Excluir anexos.                                                 |
| project.read             | Consultar projetos visíveis.                                    |
| project.create           | Criar projetos.                                                 |
| project.update           | Alterar projetos visíveis.                                      |
| project.archive          | Arquivar projetos visíveis.                                     |
| project.manage_members   | Administrar participantes do projeto.                           |
| project.manage_all       | Acesso administrativo a todos os projetos, sem vínculo local.   |
| milestone.manage         | Administrar marcos de projetos visíveis.                        |
| environment.manage       | Administrar ambientes de projetos visíveis.                     |
| testcase.read            | Consultar suítes, casos e passos.                               |
| testcase.create          | Criar suítes e casos.                                           |
| testcase.update          | Alterar suítes, casos, passos e vínculos.                       |
| testcase.archive         | Arquivar suítes e arquivar/restaurar casos.                     |
| testrun.read             | Consultar planos, execuções, resultados e comentários.          |
| testrun.execute          | Iniciar/concluir execuções, registrar resultados e comentários. |
| testrun.manage           | Administrar planos, criar execuções e abortá-las.               |
| defect.read              | Consultar defeitos e seus vínculos.                             |
| defect.manage            | Criar e alterar defeitos, estados e vínculos.                   |
| governance.read | Consultar governança. |
| governance.assess | Avaliar controles e evidências. |
| governance.manage | Administrar frameworks, metas e ações. |

Compatibilidade: GET /permissions e os DTOs de concessões incluem oito códigos
novos na Fase 02 e quatro na Fase 03 e três na Fase 04 e duas na Fase 05 e três na Fase 06 (32 no total). Owner/Administrator acompanham o catálogo; Member recebe
project.read/testcase.read/testrun.read/defect.read/governance.read. Roles customizadas não são ampliadas automaticamente. Remoção
de WorkspaceMember também remove suas concessões de Project; reentrada por
convite não recupera acesso local antigo. Payloads de identidade/convites não mudam.

## Erros

Problem Details: type/title/status/detail/instance/code/requestId/timestamp e
errors opcional. Tratar code/HTTP; não comparar texto da mensagem. errors
contém field/code/message para validação. Preservar X-Request-Id para diagnóstico.

401 segue [autenticação](authentication.md); 403 falta de permission no escopo
visível; 404 recurso/Workspace inexistente ou não visível, sem confirmar outro
tenant. 409 representa conflitos descritos por endpoint. Desde 08/10/2026,
as operações autenticadas não têm quota geral; 429/Retry-After fica reservado
ao cooldown do reenvio de convites neste módulo.
500/503 não autorizam retry cego de mutação. Códigos específicos dos guias
aplicam-se apenas à operação que possui aquela regra.

## Modelos de resposta

A seguir, campos de data ou itens de listagem. Relações são DTOs explícitos;
nenhuma resposta inclui passwordHash, sessões, tokenHash, payload cifrado ou storageKey.

## WorkspaceResponse

Criação, listagem e consulta incluem memberId/isOwner/permissions do usuário
atual. Alteração e transferência retornam os dados do Workspace sem esses
três campos; recarregar a consulta para atualizar capacidades após a mutação.

| Campo         | Tipo/formato | Obrigatório | Regras                                     |
| ------------- | ------------ | ----------- | ------------------------------------------ |
| id            | uuid         | sim         | Conforme o endpoint.                       |
| name          | string       | sim         | Conforme o endpoint.                       |
| slug          | string       | sim         | Conforme o endpoint.                       |
| status        | string       | sim         | Valores: "ACTIVE", "SUSPENDED", "ARCHIVED" |
| ownerMemberId | uuid         | sim         | Conforme o endpoint.                       |
| createdAt     | date-time    | sim         | Conforme o endpoint.                       |
| updatedAt     | date-time    | sim         | Conforme o endpoint.                       |
| memberId      | uuid         | não         | Conforme o endpoint.                       |
| isOwner       | boolean      | não         | Conforme o endpoint.                       |
| permissions   | string[]     | não         | Conforme o endpoint.                       |

## MemberResponse

| Campo       | Tipo/formato                                                              | Obrigatório | Regras                                    |
| ----------- | ------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| id          | uuid                                                                      | sim         | Conforme o endpoint.                      |
| workspaceId | uuid                                                                      | sim         | Conforme o endpoint.                      |
| userId      | uuid                                                                      | sim         | Conforme o endpoint.                      |
| status      | string                                                                    | sim         | Valores: "ACTIVE", "SUSPENDED", "REMOVED" |
| joinedAt    | date-time                                                                 | sim         | Conforme o endpoint.                      |
| user        | [DirectoryUserResponse](workspace-contracts.md#directoryuserresponse)     | sim         | Conforme o endpoint.                      |
| isOwner     | boolean                                                                   | sim         | Conforme o endpoint.                      |
| roles       | [RoleOriginResponse](workspace-contracts.md#roleoriginresponse)[]         | sim         | Conforme o endpoint.                      |
| groups      | [GroupReferenceResponse](workspace-contracts.md#groupreferenceresponse)[] | sim         | Conforme o endpoint.                      |

## DirectoryUserResponse

| Campo           | Tipo/formato | Obrigatório | Regras                         |
| --------------- | ------------ | ----------- | ------------------------------ |
| id              | uuid         | sim         | Conforme o endpoint.           |
| email           | email        | sim         | Conforme o endpoint.           |
| displayName     | string       | sim         | Conforme o endpoint.           |
| status          | string       | sim         | Valores: "ACTIVE", "SUSPENDED" |
| emailVerifiedAt | date-time    | sim         | Conforme o endpoint.           |

## RoleOriginResponse

| Campo   | Tipo/formato | Obrigatório | Regras                     |
| ------- | ------------ | ----------- | -------------------------- |
| id      | uuid         | sim         | Conforme o endpoint.       |
| name    | string       | sim         | Conforme o endpoint.       |
| source  | string       | sim         | Valores: "DIRECT", "GROUP" |
| groupId | uuid         | sim         | Aceita null.               |

## GroupReferenceResponse

| Campo | Tipo/formato | Obrigatório | Regras               |
| ----- | ------------ | ----------- | -------------------- |
| id    | uuid         | sim         | Conforme o endpoint. |
| name  | string       | sim         | Conforme o endpoint. |

## InvitationResponse

| Campo          | Tipo/formato | Obrigatório | Regras                                                |
| -------------- | ------------ | ----------- | ----------------------------------------------------- |
| id             | uuid         | sim         | Conforme o endpoint.                                  |
| workspaceId    | uuid         | sim         | Conforme o endpoint.                                  |
| email          | email        | sim         | Conforme o endpoint.                                  |
| status         | string       | sim         | Valores: "PENDING", "ACCEPTED", "CANCELED", "EXPIRED" |
| expiresAt      | date-time    | sim         | Conforme o endpoint.                                  |
| invitedBy      | uuid         | sim         | Conforme o endpoint.                                  |
| acceptedAt     | date-time    | sim         | Aceita null.                                          |
| createdAt      | date-time    | sim         | Conforme o endpoint.                                  |
| lastSentAt     | date-time    | sim         | Conforme o endpoint.                                  |
| deliveryStatus | string       | sim         | Valores: "PENDING", "SENT", "FAILED"                  |

## MembershipResponse

| Campo       | Tipo/formato | Obrigatório | Regras                                    |
| ----------- | ------------ | ----------- | ----------------------------------------- |
| id          | uuid         | sim         | Conforme o endpoint.                      |
| workspaceId | uuid         | sim         | Conforme o endpoint.                      |
| userId      | uuid         | sim         | Conforme o endpoint.                      |
| status      | string       | sim         | Valores: "ACTIVE", "SUSPENDED", "REMOVED" |
| joinedAt    | date-time    | sim         | Conforme o endpoint.                      |

## PermissionCatalogResponse

| Campo       | Tipo/formato                                                      | Obrigatório | Regras               |
| ----------- | ----------------------------------------------------------------- | ----------- | -------------------- |
| permissions | [PermissionResponse](workspace-contracts.md#permissionresponse)[] | sim         | Conforme o endpoint. |

## PermissionResponse

| Campo       | Tipo/formato | Obrigatório | Regras                                                                                                                                                                                                                                              |
| ----------- | ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| code        | string       | sim         | Valores: "workspace.read", "workspace.update", "workspace.manage_members", "workspace.manage_roles", "workspace.manage_groups", "field.read", "field.manage", "tag.read", "tag.manage", "attachment.read", "attachment.upload", "attachment.delete" |
| description | string       | sim         | Conforme o endpoint.                                                                                                                                                                                                                                |

## RoleResponse

| Campo           | Tipo/formato | Obrigatório | Regras               |
| --------------- | ------------ | ----------- | -------------------- |
| id              | uuid         | sim         | Conforme o endpoint. |
| workspaceId     | uuid         | sim         | Conforme o endpoint. |
| name            | string       | sim         | Conforme o endpoint. |
| description     | string       | sim         | Aceita null.         |
| systemRole      | boolean      | sim         | Conforme o endpoint. |
| createdAt       | date-time    | sim         | Conforme o endpoint. |
| permissionCodes | string[]     | sim         | Conforme o endpoint. |

## GroupResponse

| Campo       | Tipo/formato | Obrigatório | Regras               |
| ----------- | ------------ | ----------- | -------------------- |
| id          | uuid         | sim         | Conforme o endpoint. |
| workspaceId | uuid         | sim         | Conforme o endpoint. |
| name        | string       | sim         | Conforme o endpoint. |
| description | string       | sim         | Aceita null.         |
| createdAt   | date-time    | sim         | Conforme o endpoint. |
| roleIds     | string[]     | sim         | Conforme o endpoint. |
| memberCount | number       | sim         | Conforme o endpoint. |

## GroupParticipantResponse

| Campo    | Tipo/formato | Obrigatório | Regras               |
| -------- | ------------ | ----------- | -------------------- |
| memberId | uuid         | sim         | Conforme o endpoint. |

## FieldResponse

| Campo       | Tipo/formato                                                        | Obrigatório | Regras                                                        |
| ----------- | ------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| id          | uuid                                                                | sim         | Conforme o endpoint.                                          |
| workspaceId | uuid                                                                | sim         | Conforme o endpoint.                                          |
| key         | string                                                              | sim         | Conforme o endpoint.                                          |
| name        | string                                                              | sim         | Conforme o endpoint.                                          |
| description | string                                                              | sim         | Aceita null.                                                  |
| type        | string                                                              | sim         | Valores: "TEXT", "NUMBER", "BOOLEAN", "DATE", "SINGLE_SELECT" |
| target      | string                                                              | sim         | Valores: "TEST_CASE"                                          |
| required    | boolean                                                             | sim         | Conforme o endpoint.                                          |
| position    | number                                                              | sim         | Conforme o endpoint.                                          |
| options     | [FieldOptionResponse](workspace-contracts.md#fieldoptionresponse)[] | sim         | Conforme o endpoint.                                          |
| archivedAt  | date-time                                                           | sim         | Aceita null.                                                  |
| createdAt   | date-time                                                           | sim         | Conforme o endpoint.                                          |
| updatedAt   | date-time                                                           | sim         | Conforme o endpoint.                                          |

## FieldOptionResponse

| Campo | Tipo/formato | Obrigatório | Regras               |
| ----- | ------------ | ----------- | -------------------- |
| id    | uuid         | sim         | Conforme o endpoint. |
| label | string       | sim         | Conforme o endpoint. |

## TagResponse

| Campo       | Tipo/formato | Obrigatório | Regras               |
| ----------- | ------------ | ----------- | -------------------- |
| id          | uuid         | sim         | Conforme o endpoint. |
| workspaceId | uuid         | sim         | Conforme o endpoint. |
| name        | string       | sim         | Conforme o endpoint. |
| createdAt   | date-time    | sim         | Conforme o endpoint. |
| updatedAt   | date-time    | sim         | Conforme o endpoint. |

## AttachmentResponse

| Campo        | Tipo/formato | Obrigatório | Regras                                                                          |
| ------------ | ------------ | ----------- | ------------------------------------------------------------------------------- |
| id           | uuid         | sim         | Conforme o endpoint.                                                            |
| workspaceId  | uuid         | sim         | Conforme o endpoint.                                                            |
| originalName | string       | sim         | Conforme o endpoint.                                                            |
| contentType  | string       | sim         | Valores: "image/png", "image/jpeg", "application/pdf", "text/plain", "text/csv" |
| sizeBytes    | number       | sim         | Conforme o endpoint.                                                            |
| checksum     | string       | sim         | SHA-256 hexadecimal.                                                            |
| uploadedBy   | uuid         | sim         | Conforme o endpoint.                                                            |
| createdAt    | date-time    | sim         | Conforme o endpoint.                                                            |

Atualização Fase 06 (03/10/2026): [Governança](governance-contracts.md) disponível.
Owner/Administrator têm os três novos grants; Member recebe governance.read.
Roles customizadas preservadas; endpoints de acesso mantêm payloads.
