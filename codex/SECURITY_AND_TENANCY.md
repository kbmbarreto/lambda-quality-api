# Segurança e isolamento de tenants

## Princípio central

Nenhum usuário obtém acesso a um recurso apenas por conhecer seu UUID.
User e autenticação são globais; membership, roles e permissões pertencem
à fronteira de Workspace. Remover um membro não elimina sua identidade ou
seu acesso legítimo a outros Workspaces.

## Autenticação e senhas

Baseline: e-mail normalizado e senha, com access token e refresh token.
Em 30/09/2026 o usuário autorizou cadastro público confirmado por código de
e-mail e recuperação de senha via SendGrid. SSO e MFA continuam fora do
escopo. Cadastro não cria Workspace ou membership automaticamente.

### Códigos de cadastro e redefinição

- Solicitar código informa somente e-mail; confirmar cadastro informa
  challengeId, código, nome e senha. O User só existe após a confirmação.
- Redefinição usa solicitação de código seguida por challengeId, código e
  nova senha; sucesso revoga todas as sessões na mesma transação.
- Código de seis dígitos gerado por CSPRNG, válido por 10 minutos, uso único,
  até cinco tentativas e intervalo de 60 segundos para reenvio por e-mail
  e finalidade. Um novo código invalida o anterior da mesma finalidade.
- Persistir HMAC-SHA-256 ligado a challengeId/e-mail/finalidade, com segredo
  externo. Códigos curtos nunca usam hash simples, nem são retornados pela API.
- OTP_HMAC_SECRET pode ser separado; o JWT_SECRET já informado no .env é
  aceito como segredo HMAC dos códigos. JWT de acesso continua usando RS256.
- Tentativas inválidas e revogação por reuso são commitadas antes do erro
  HTTP. Locks/transações serializam consumo e reenvio; propósitos são distintos.
- Solicitações válidas enviam a mesma mensagem neutra de código para o
  endereço informado, exista ou não uma conta. A elegibilidade é verificada
  na confirmação. Isso uniformiza resposta e falhas do provedor e não permite
  criar conta duplicada ou redefinir senha de conta inexistente/suspensa.
- Aceite HTTP 202 do SendGrid não comprova entrega na caixa postal. Falha
  imediata de envio invalida o desafio e retorna 503 EMAIL_DELIVERY_UNAVAILABLE.
- Senhas novas: 12 a 128 caracteres, sem truncamento; login aceita senhas
  de 1 a 128 caracteres para tratar credenciais inválidas uniformemente.
- Auditoria inicial registra eventos de identidade sem segredos; detalhes
  de negócio e metadata adicionais serão ampliados na fase correspondente.

- Armazenar senha apenas como hash Argon2id com salt único. Base mínima:
  19 MiB de memória, 2 iterações e paralelismo 1; calibrar para o ambiente.
- SHA-256 serve para hash de tokens aleatórios fortes, nunca para senhas.
- Login inválido retorna `401 AUTH_INVALID_CREDENTIALS` e mensagem genérica,
  sem distinguir conta inexistente, senha incorreta ou usuário suspenso.
- Limitar tentativas de login e refresh; `429 RATE_LIMIT_EXCEEDED` com
  `Retry-After`. Limites configuráveis e testados; não confiar cegamente
  em IP encaminhado por proxies não configurados.
- Na entrega atual, o limite de identidade é 20 chamadas por IP/60 segundos,
  configurável, em memória por processo, para cadastro/login/refresh/redefinição.
  Desde 08/10/2026, me/logout/logout-all e operações de negócio autenticadas
  não consomem quota geral de requisições; validação/sessão/grants por fonte
  permanecem. Reenvio e tentativas de código são
  controlados também no MySQL. Antes de múltiplas instâncias, substituir o
  limitador por estado compartilhado. Não habilitar trust proxy indiscriminadamente.
- Usar HTTPS fora do desenvolvimento local e CORS com origens explícitas.

Referência: [armazenamento de senhas da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Access token: bearer JWT

Enviar em `Authorization: Bearer <accessToken>`; não em URL/query string.
Validade padrão de **15 minutos**, configurável.

- Assinar com RS256, chave privada externa ao repositório e `kid` para
  rotação. Aceitar somente algoritmo e chaves explicitamente configurados.
- Claims: `sub` (User), `sid` (AuthSession), `jti`, `iss`, `aud`, `iat`,
  `exp` e `tokenUse: "access"`. Validar assinatura, emissor, audiência,
  finalidade e expiração; validar `nbf` se presente.
- Não incluir senha, dados secretos ou lista de permissões como fonte de
  autorização. Não permitir que o cliente escolha claims ou algoritmo.
- Em cada requisição protegida, consultar estado atual do User e da sessão;
  rejeitar sessões revogadas/expiradas. JWT válido sozinho não garante acesso.
- Membership e permissões atuais são resolvidos para o Workspace da URL.
  Revogação de sessão e remoção de membership valem na próxima requisição
  após o commit. Não introduzir cache que prolongue permissões revogadas
  sem definir e documentar uma política de invalidação.

## Refresh token e sessões

Refresh token **opaco**, gerado por CSPRNG com pelo menos 32 bytes de
entropia e codificado em base64url; não é bearer de acesso a recursos.
Armazenar somente SHA-256 do token; nunca o token em texto puro.

Uma AuthSession corresponde a um login/dispositivo e à família de tokens
renováveis. Expira no máximo em **7 dias** após o login, com expiração por
inatividade de **24 horas**, ambas configuráveis. A renovação não estende
esse limite absoluto; o novo token expira em
`min(agora + prazo de inatividade, session.expiresAt)`.

Fluxo de renovação:

1. Localizar o hash do token e bloquear sua sessão em transação.
2. Validar usuário, sessão e token atuais, expiração e ausência de revogação.
3. Marcar o token anterior como consumido e inserir seu sucessor na mesma
   sessão/transação; emitir novo par somente após o commit.
4. Se um token já consumido for reapresentado, revogar a sessão e sua família
   e retornar `401 AUTH_REFRESH_TOKEN_REUSED`. A revogação deve ser
   **commitada antes de responder ao erro**, sem rollback causado pela
   exceção HTTP. Hash desconhecido retorna `AUTH_INVALID_REFRESH_TOKEN`
   e não permite identificar/revogar arbitrariamente outra sessão.

Conservar hashes consumidos até expirar a família para detectar reuso.
Renovações concorrentes são serializadas pela sessão; apenas uma consome o
mesmo token, e a segunda ativa a política de reuso. Clientes devem executar
uma única renovação por vez e não repetir cegamente um refresh após timeout;
se perderem a resposta, será necessário novo login.

Referência para a rotação e detecção de reuso:
[RFC 9700, seção 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).
Esta API de login própria não é uma implementação completa de OAuth/OIDC.

### Logout e revogação

- `logout`: autenticado por access token, revoga a sessão indicada por `sid`
  e todos os refresh tokens dessa sessão. Não aceita `sid` arbitrário no body.
- `logout-all`: revoga todas as sessões do usuário autenticado.
- Suspensão de usuário, troca de senha ou comprometimento revogam todas as
  sessões quando esses fluxos existirem. Rotação de chave tem política
  explícita de retenção/revogação das chaves anteriores.
- Access tokens associados deixam de funcionar na próxima requisição após
  revogação, mesmo antes de `exp`, pela consulta da sessão ativa.

### Transporte dos tokens

O contrato inicial de backend retorna os dois tokens no JSON de login e
refresh e recebe refresh token no body. Respostas com tokens usam
`Cache-Control: no-store` e `Pragma: no-cache`; logs e telemetria devem
redigir `Authorization`, senhas, tokens e payloads de autenticação/convite.

Consumidores servidores usam armazenamento seguro; clientes de navegador
mantêm tokens em memória, sem persistir refresh token em localStorage ou
sessionStorage. Quando a integração web for definida, documentar a
possibilidade de refresh em cookie HttpOnly/Secure, com SameSite, escopo e
proteção CSRF apropriados, antes de mudar o contrato. Não habilitar modos
JSON/cookie simultaneamente sem contratos separados e testes.

## Tenant Context e política de visibilidade

Após autenticação, resolver membership ativo e estado do Workspace
solicitado; disponibilizar contexto à autorização e persistência.

```typescript
// Contrato de port; o adapter sempre filtra pelo tenant.
repository.findByIdAndWorkspaceId({ id, workspaceId });
```

Para recursos de Project, validar também `projectId` e o escopo do membro
quando aplicável. FKs compostas reforçam a regra no banco; a autorização
continua obrigatória na aplicação.

- Sem identidade/sessão válida: **401**.
- Workspace ou recurso inexistente, de outro tenant ou projeto não visível:
  **404 RESOURCE_NOT_FOUND**, com a mesma mensagem genérica.
- Recurso no escopo visível, mas sem permission para a operação: **403
  AUTH_FORBIDDEN**. Não consultar recurso fora do escopo para decidir o erro.

## RBAC

```text
User → WorkspaceMember → Role → Permission
                       ↘ Group → Role
```

ProjectMember pode complementar o escopo de projeto.

Catálogo atualizado em 06/10/2026, 35 permissions (inclui o cofre por projeto):

```text
workspace.read workspace.update workspace.manage_members
workspace.manage_roles workspace.manage_groups
field.read field.manage tag.read tag.manage
attachment.read attachment.upload attachment.delete
project.read project.create project.update project.archive
project.manage_members project.manage_all milestone.manage environment.manage
testcase.read testcase.create testcase.update testcase.archive
testrun.read testrun.execute testrun.manage
defect.read defect.manage
governance.read governance.assess governance.manage
```

Owner é `ownerMemberId`, separado das roles, com as 35 permissions e
transferência exclusiva de ownership. Administrator tem as 35 permissions
sem ownership. Member tem workspace.read/field.read/tag.read/attachment.read/project.read/testcase.read/testrun.read/defect.read/governance.read.
Roles de sistema são imutáveis. União de roles diretas e de grupos é resolvida
no banco a cada operação, com lock do Workspace durante autorização e ação.
Ator não concede permissions que ele próprio não possui. Remoção limpa roles
e grupos, preservando User e outros tenants; reentrada por convite concede
somente Member. Convite não reativa vínculo SUSPENDED.

ProjectMember exige WorkspaceMember ativo; revogação do Workspace bloqueia
também seus projetos. Remoção limpa ProjectMember transacionalmente, evitando
recuperar concessões antigas na reentrada. Vínculo local VIEWER/EDITOR/MANAGER
limita capabilities por interseção com permissions atuais do Workspace.
project.manage_all dispensa vínculo local, sem dispensar a permission da ação.
Listas, contagens e buscas consideram visibilidade do projeto antes de paginar.
Filhos são buscados por workspaceId + projectId + id, incluindo mutações.
Role local atribuída não pode superar capabilities do ator no projeto.
Detalhes na [matriz de acesso](../front-specs/project-contracts.md#acesso).

Permissions de testcase estão disponíveis na Fase 03. A matriz local de
Projeto inclui read para VIEWER, read/create/update para EDITOR e archive para
MANAGER, intersectando grants atuais. Valores e links usam FKs compostas;
download mantém attachment.read na biblioteca do Workspace.

Fase 04 acrescenta testrun.read (VIEWER), execute (EDITOR) e manage (MANAGER),
sempre intersectando grants atuais. Criação de Run, ativação/seleção de plano
exigem também testcase.read; resultados e comentários não editam snapshots.

Fase 05 acrescenta defect.read (VIEWER) e defect.manage (EDITOR/MANAGER).
Origem FAILED exige testrun.read; anexar exige attachment.read. Nenhum desses
vínculos concede leitura de arquivo ou alteração de resultado.

Fase 06 acrescenta governance.read/assess/manage, sem ampliar matriz local de
Projeto. Evidências de arquivo mantêm attachment.read e snapshot sem storageKey.
Meta de Projeto/ação ligada exige visibilidade atual; cálculo exige leitura da
fonte. Meta de Workspace exige todos os Projetos ACTIVE, jamais parcial; leitura
histórica valida também sourceIds. Listas/dashboard ocultam metas e ações sem
acesso antes de contar. Avaliações CLOSED imutáveis; audit e version atômicos.

Demais permissions abaixo são futuras, sem implicar concessões ou endpoints atuais:

```text
requirement.manage integration.manage audit.read
```

## Convites

Token aleatório forte, hash persistido, validade curta/configurável e uso
único; invalidar ao aceitar/cancelar. Receber token no body de aceite, não
no caminho da API, para reduzir exposição em logs. Aceite exige usuário
autenticado cujo e-mail corresponda ao convite; criar conta é um fluxo
separado de provisionamento, já entregue no módulo de identidade.

Na Fase 01, validade padrão 48 horas e reenvio após 60 segundos. SHA-256
verifica token aleatório de 32 bytes; reenvio substitui o hash anterior.
Intenção de envio é persistida na mesma transação em deliveryPayload cifrado
AES-256-GCM, com segredo estável configurável. Worker tenta até cinco vezes,
com backoff, e remove payload após envio/aceite/cancelamento/expiração/limite.
Não guardar token em logs, auditoria ou DTOs. Link do front opcional usa
fragmento; cliente extrai e remove o fragmento antes de enviar token no body.
Retry de aceite é idempotente apenas para o mesmo usuário com vínculo ativo.

Anexos privados exigem bearer/membership/permission em metadados e bytes.
MIME é validado por conteúdo, tamanho limitado e nome tratado como dado.
Os bytes ficam no Oracle OCI Object Storage em bucket privado (NoPublicAccess),
com prefixo exclusivo da aplicação. Credenciais/chave RSA permanecem no backend;
nenhuma URL pública ou PAR é emitida. Upload em memória, download por stream
autorizado, attachment, nosniff e no-store. Sem fallback no disco do servidor.
Limpeza física na OCI é posterior à exclusão lógica auditada e restrita ao
prefixo e às chaves UUID da aplicação. Ver [operação OCI](OCI_STORAGE_IMPLEMENTATION_DECISIONS.md).

## Integrações

Credenciais próprias, escopadas por Workspace/Project, armazenadas como
hash quando forem API keys verificáveis. Rotação e revogação obrigatórias.
Não aceitar refresh token como credencial de integração. Nunca registrar
segredo em log/audit.

## Arquivos e auditoria

Validar tamanho, MIME permitido e nome; storage key não derivada diretamente
do nome fornecido; autorização também no download; checksum; abstração
para object storage.

Auditoria registra ator, Workspace quando aplicável, ação, entidade,
timestamp e correlationId, usando o mesmo valor de `requestId` do HTTP.
Eventos de identidade anteriores à seleção do tenant permitem Workspace
nulo. Não registrar senha, JWT, API key, token de convite ou refresh token.

## Testes de segurança obrigatórios

- Login válido/inválido, usuário suspenso e rate limit.
- JWT ausente, expirado, assinatura/algoritmo/issuer/audience/finalidade inválidos.
- Refresh desconhecido, expirado, revogado, rotacionado e reutilizado.
- Refresh concorrente: um consumo, revogação persistida por reuso e nenhum
  sucessor utilizável depois da revogação.
- Cadastro/redefinição: finalidade, código incorreto/expirado/usado, limite
  de tentativas, reenvio, falha SendGrid e revogação de todas as sessões.
- Logout corrente/todas as sessões, sessão expirada e suspensão de usuário.
- Usuário A não lê/altera recurso do Workspace B; política uniforme de 404.
- Membro removido perde acesso; role sem permission falha.
- ProjectMember não acessa projeto fora do escopo.
- API key de integração não publica em outro Workspace.
- Attachment não vaza entre tenants; respostas e logs não expõem segredos.

## Cofre de testes — 06/10/2026

Novos grants testvault.read/manage/reveal. Os campos sensíveis são cifrados em
AES-256-GCM com chave independente externa ao banco e AAD tenant/projeto/entrada.
Listagem somente metadados; revelação explícita, autorizada e auditada antes da
resposta. Sem secrets na auditoria/Problem Details. Papéis locais são intersectados
com grants atuais; atribuição de participantes não pode ampliar o acesso efetivo
novo ao cofre além do ator. Ver [decisões](PRODUCT_IMPROVEMENTS_20261006.md).
