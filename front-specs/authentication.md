# Autenticação e criação de usuários

Disponibilidade: **implementado**. API v1, guia concluído em 01/10/2026.
OpenAPI: `/docs-json`; interface de testes: `/docs`. As operações abaixo
não criam Workspace ou membership. Todos os caminhos incluem `/api/v1`.

## Convenções comuns

Enviar JSON com `Content-Type: application/json`. Não existem parâmetros
de rota/query nestes endpoints; queries e campos extras são rejeitados.
`X-Request-Id` é opcional; usar UUID válido ou deixar o servidor gerar.
Endpoints públicos não precisam de bearer. Somente me/logout/logout-all
exigem `Authorization: Bearer <accessToken>`, sem permissões de Workspace.

Sucesso 200/201/202 usa `{data,message,meta}`. Os exemplos de `data` em cada
seção devem ser interpretados dentro deste envelope completo:

```json
{
  "data": {
    "challengeId": "b4bfc371-5831-4e2e-97ab-08e05b3e25dd",
    "expiresIn": 600,
    "resendAfter": 60
  },
  "message": "Código de confirmação enviado. Consulte seu e-mail.",
  "meta": {
    "requestId": "6d738190-4a53-4b5b-9e92-7b6206f49923",
    "timestamp": "2026-10-01T10:00:00.000-03:00"
  }
}
```

`X-Request-Id` corresponde a `meta.requestId`. Respostas 204 não possuem
corpo: não chamar `response.json()`. Não há paginação/listagens neste módulo.

Erro usa `application/problem+json`, com o formato abaixo. `errors` aparece
em validações por campo; nenhum valor secreto rejeitado é devolvido.

```json
{
  "type": "urn:lambdaquality:problem:validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "Revise os dados da solicitação.",
  "instance": "/api/v1/auth/register",
  "code": "VALIDATION_ERROR",
  "requestId": "6d738190-4a53-4b5b-9e92-7b6206f49923",
  "timestamp": "2026-10-01T10:00:00.000-03:00",
  "errors": [
    {
      "field": "password",
      "code": "TOO_SHORT",
      "message": "A senha deve ter pelo menos 12 caracteres."
    }
  ]
}
```

Cadastro, login, refresh e redefinição de senha compartilham limite padrão
de 20 chamadas por IP a cada 60 segundos, configurável. 429 inclui
`Retry-After` em segundos. Desde 08/10/2026, me, logout e logout-all não
consomem essa quota; exigem bearer e validação de sessão atual.
O cooldown de reenvio também é aplicado no banco por e-mail/finalidade.

| HTTP / code | Tratamento comum |
| --- | --- |
| 400 VALIDATION_ERROR | Vincular errors ao formulário; corrigir antes de reenviar |
| 400 AUTH_INVALID_EMAIL_CODE | Código incorreto, expirado, consumido ou inelegível; permitir nova solicitação respeitando cooldown |
| 429 RATE_LIMIT_EXCEEDED | Exibir espera baseada em Retry-After; desabilitar submissão temporariamente |
| 503 EMAIL_DELIVERY_UNAVAILABLE | Envio ao provedor falhou; desafio invalidado; solicitar outro após cooldown |
| 503 SERVICE_UNAVAILABLE | Dependência indisponível; preservar formulário e permitir tentativa posterior |
| 500 INTERNAL_ERROR | Mostrar falha genérica com requestId; não repetir mutação automaticamente |

## POST /api/v1/auth/registration/code

OpenAPI operationId: `requestRegistrationCode`. Público. Usado ao iniciar
cadastro ou reenviar confirmação; recebe e-mail válido, máximo 254 caracteres,
normalizado pelo servidor com trim/lowercase. Não informar senha nesta etapa.

```json
{"email":"usuario@example.com"}
```

Retorna **202**, no envelope exemplificado acima. `challengeId` é UUID v4;
`expiresIn` indica validade em segundos; `resendAfter` indica espera mínima
para reenvio. Os valores padrão são 600 e 60. O código não aparece na API.
Um novo desafio invalida o anterior da mesma finalidade.

Fluxo: loading → salvar challengeId e prazo → abrir formulário de código,
nome e senha → iniciar contador de reenvio. Erros relevantes: 400, 429 e 503
da tabela comum. A resposta não confirma se o e-mail já possui conta; a mesma
mensagem neutra é enviada a endereços elegíveis e inelegíveis. Aceite pelo
SendGrid não garante chegada na caixa postal; orientar consulta ao spam.

## POST /api/v1/auth/register

OpenAPI operationId: `registerUser`. Público. Conclui o cadastro após o código.

| Campo do body | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- |
| challengeId | string | Sim | UUID v4 recebido na solicitação de cadastro |
| code | string | Sim | Exatamente seis dígitos; preservar zeros à esquerda |
| displayName | string | Sim | 2–100 caracteres após trim |
| password | string | Sim | 12–128 caracteres; não aplicar trim ou truncamento |

```json
{
  "challengeId":"b4bfc371-5831-4e2e-97ab-08e05b3e25dd",
  "code":"123456",
  "displayName":"Usuário Exemplo",
  "password":"SenhaExemploForte123!"
}
```

Retorna **201**, mensagem "Usuário criado com sucesso. Faça login para
continuar." e header `Location: /api/v1/auth/me`. `data` tem o formato de
usuário abaixo. Datas são ISO 8601 com offset -03:00; não há hash/senha nem tokens nesta resposta.

```json
{
  "id":"c357b711-84be-4f08-949a-6cb0cfef3bdd",
  "email":"usuario@example.com",
  "displayName":"Usuário Exemplo",
  "status":"ACTIVE",
  "emailVerifiedAt":"2026-10-01T10:00:00.000-03:00",
  "createdAt":"2026-10-01T10:00:00.000-03:00"
}
```

Fluxo: validar formulário → bloquear submissão duplicada → enviar → limpar
senha/código → navegar para login. Código é de uso único, com até cinco
tentativas. Usar erros 400 por campo ou AUTH_INVALID_EMAIL_CODE; 409
RESOURCE_CONFLICT indica conflito concorrente. Após timeout, não repetir
cegamente a criação: o cadastro pode ter sido concluído; oferecer login ou
nova solicitação. Cadastro não atribui roles nem cria acesso a Workspace.

## POST /api/v1/auth/password-reset/code

OpenAPI operationId: `requestPasswordResetCode`. Público. Solicita o código
de recuperação. Body e regras de e-mail são iguais à solicitação de cadastro.

```json
{"email":"usuario@example.com"}
```

Retorna **202** com o mesmo `data` de solicitação de código. Mensagem:
"Código enviado. A redefinição depende de uma conta elegível." Salvar o novo
challengeId, abrir formulário de código/nova senha e iniciar contador de
reenvio. Cadastro e recuperação usam finalidades diferentes; nunca reutilizar
um challengeId de cadastro. Erros: 400, 429, 503 e 500 da tabela comum.

## POST /api/v1/auth/password-reset

OpenAPI operationId: `resetPassword`. Público. Body obrigatório:

| Campo | Tipo | Regras |
| --- | --- | --- |
| challengeId | string | UUID v4 recebido na recuperação |
| code | string | Seis dígitos, uso único, até cinco tentativas |
| newPassword | string | 12–128 caracteres, sem trim/truncamento |

```json
{
  "challengeId":"b4bfc371-5831-4e2e-97ab-08e05b3e25dd",
  "code":"123456",
  "newPassword":"OutraSenhaExemplo123!"
}
```

Retorna **204**, sem corpo. Revoga todas as sessões de forma atômica e não
emite novos tokens. Limpar credenciais/cache local e navegar para login.
Erros: 400 AUTH_INVALID_EMAIL_CODE/VALIDATION_ERROR e falhas comuns. Após
timeout, confirmar pelo login com a nova senha antes de repetir a mutação.

## POST /api/v1/auth/login

OpenAPI operationId: `login`. Público. E-mail obrigatório como nas seções
anteriores; senha string obrigatória de 1–128 caracteres, sem trim.

```json
{"email":"usuario@example.com","password":"SenhaExemploForte123!"}
```

Retorna **200**, com `Cache-Control: no-store` e `Pragma: no-cache`:

```json
{
  "data": {
    "accessToken":"<jwt-de-acesso>",
    "refreshToken":"<token-opaco-de-43-caracteres>",
    "tokenType":"Bearer",
    "expiresIn":900,
    "refreshExpiresIn":86400
  },
  "message":"Autenticação realizada com sucesso.",
  "meta": {
    "requestId":"6d738190-4a53-4b5b-9e92-7b6206f49923",
    "timestamp":"2026-10-01T10:00:00.000-03:00"
  }
}
```

Prazos em segundos são configuráveis; refresh fica limitado à expiração
absoluta da sessão, padrão de sete dias. Armazenar o par somente em memória
no navegador e carregar me. 401 AUTH_INVALID_CREDENTIALS tem mensagem
genérica para conta inexistente, senha incorreta ou usuário suspenso. Não
repetir login automaticamente nem exibir distinções sobre existência da conta.

## POST /api/v1/auth/refresh

OpenAPI operationId: `refreshSession`. Não exige bearer, exige refresh token
no body: string base64url de 43 caracteres, recebida no login/refresh.

```json
{"refreshToken":"<refresh-token-recebido-no-login>"}
```

Retorna **200**, mesmo envelope/campos/headers de login; mensagem "Sessão
renovada com sucesso." Substituir os dois tokens e descartar o par anterior.
O token apresentado só pode ser consumido uma vez; o prazo de inatividade
padrão é de 24 horas, sem estender os sete dias de validade absoluta.

Executar uma única renovação por vez, compartilhando o resultado entre
chamadas pendentes. Não repetir refresh após timeout: reuso revoga a família
e invalida inclusive o token vencedor de uma disputa concorrente.

| 401 / code | Ação |
| --- | --- |
| AUTH_INVALID_REFRESH_TOKEN | Limpar sessão local e pedir novo login |
| AUTH_REFRESH_TOKEN_EXPIRED | Novo login |
| AUTH_REFRESH_TOKEN_REUSED | Sessão/família revogada; novo login obrigatório |
| AUTH_SESSION_REVOKED / AUTH_SESSION_EXPIRED | Novo login; não tentar renovar novamente |

Também se aplicam validação 400, limite 429 e falhas comuns.

## GET /api/v1/auth/me

Sem quota de chamadas da API desde 08/10/2026. O limite das tentativas
de autenticação não bloqueia esta operação autenticada.


OpenAPI operationId: `getCurrentUser`. Exige bearer; sem body/query. Retorna
**200**, envelope padrão com `data` no formato de usuário do cadastro e
mensagem "Usuário consultado com sucesso." `status` segue ACTIVE/SUSPENDED
no schema; a autorização rejeita usuários suspensos. Headers no-store/no-cache.

Fluxo: loading → atualizar perfil → exibir área autenticada. 401
AUTH_ACCESS_TOKEN_EXPIRED permite uma tentativa coordenada de refresh.
AUTH_UNAUTHENTICATED, AUTH_INVALID_ACCESS_TOKEN, AUTH_SESSION_REVOKED ou
AUTH_SESSION_EXPIRED exigem novo login. Não tentar refresh em loop para todo
401. No erro, encerrar loading e impedir apresentação de dados de sessão antiga.

## POST /api/v1/auth/logout


Sem quota de chamadas da API desde 08/10/2026. O limite das tentativas
de autenticação não bloqueia esta operação autenticada.

OpenAPI operationId: `logout`. Exige bearer. Sem parâmetros; body ausente
ou `{}`; campos extras são rejeitados. Revoga a sessão do token validado,
sem aceitar ID de usuário/sessão enviado pelo front. Retorna **204**, sem corpo.

Limpar tokens e dados de usuário/Workspace do cache, redirecionando para login.
Outras sessões permanecem válidas. Erros 401 seguem a tabela de me; se o
servidor estiver indisponível, distinguir logout local de revogação confirmada
no servidor. Não informar que todas as sessões foram encerradas neste endpoint.

## POST /api/v1/auth/logout-all

Sem quota de chamadas da API desde 08/10/2026. O limite das tentativas
de autenticação não bloqueia esta operação autenticada.


OpenAPI operationId: `logoutAll`. Exige bearer. Mesmas regras de body e
erros de logout; retorna **204**, sem corpo. Revoga todas as sessões do
usuário autenticado. Limpar cache/tokens e pedir novo login. A próxima chamada
com qualquer access token das sessões revogadas retorna 401.

## Compatibilidade e verificação da entrega

Primeira versão dos endpoints; não há contrato anterior para migrar.
Código/senha não aparecem nos logs; tokens e hashes não são retornados no
perfil. Loading sempre deve terminar em sucesso ou falha. Limpar dados
do usuário/tenant ao encerrar ou trocar contexto de sessão.

Referências: [API_SPEC](../codex/API_SPEC.md),
[segurança](../codex/SECURITY_AND_TENANCY.md) e OpenAPI `/docs-json`.
Verificados: 24 testes de lógica/HTTP/infraestrutura e seis testes MySQL,
incluindo concorrência, consumo de códigos e revogação. SendGrid foi mockado
nos testes automatizados; entrega real depende de API key e remetente
verificado. A integração usa a API SendGrid; variáveis SMTP MAIL_HOST,
MAIL_PORT e MAIL_PASSWORD não são utilizadas nesta entrega.
