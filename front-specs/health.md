# Saúde e disponibilidade

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](../codex/MARIADB_COMPATIBILITY.md).

Disponibilidade: **implementado**. API v1; guia concluído em 01/10/2026.
OpenAPI `/docs-json`. Nenhuma destas rotas exige bearer ou permissão tenant.
Sem body/parâmetros; o front não precisa consultar liveness antes de cada ação.

Em 05/10/2026, OCI foi desacoplado do bootstrap. `ready: up` confirma banco/esquema,
sem garantir a disponibilidade dos anexos. PEM/configuração/acesso OCI inválidos
não derrubam a API; upload/download podem retornar `503 ATTACHMENT_STORAGE_UNAVAILABLE`
enquanto esses healthchecks retornam `200`. Contrato desses healthchecks preservado.

## GET /api/v1/health/live

operationId `liveness`. Verifica o processo, independentemente do banco.
Retorna **200** com o envelope abaixo. `X-Request-Id` coincide com meta.requestId.

```json
{
  "data":{"status":"up"},
  "message":"Aplicação em execução.",
  "meta":{
    "requestId":"6d738190-4a53-4b5b-9e92-7b6206f49923",
    "timestamp":"2026-10-01T10:00:00.000-03:00"
  }
}
```

Não concluir que o banco/SendGrid funciona somente a partir dessa resposta.
Falha de rede/timeout indica ausência de resposta, sem código HTTP de sucesso.

## GET /api/v1/health/ready

operationId `readiness`. Verifica acesso ao MySQL/MariaDB e à tabela users, exigindo
migrations aplicadas. Retorna **200** com o mesmo data/meta de live, mensagem
"Aplicação pronta para atender." Não verifica a entrega de e-mail SendGrid.

Se a dependência falhar, retorna **503** em `application/problem+json`:

```json
{
  "type":"urn:lambdaquality:problem:service-unavailable",
  "title":"Falha ao processar solicitação",
  "status":503,
  "detail":"Aplicação temporariamente indisponível.",
  "instance":"/api/v1/health/ready",
  "code":"SERVICE_UNAVAILABLE",
  "requestId":"6d738190-4a53-4b5b-9e92-7b6206f49923",
  "timestamp":"2026-10-01T10:00:00.000-03:00"
}
```

Fluxo: loading → exibir estado disponível/indisponível → encerrar loading.
Consultas GET podem ser repetidas com espera; não fazer loop contínuo.
Não exibir credenciais/endereço de banco e não invalidar sessão do usuário
somente porque readiness falhou. Sem paginação, filtros ou efeitos em cache.

Primeira versão, sem migração de consumidor. Verificadas via Supertest,
incluindo 503 com falha de dependência simulada e 200 com MySQL real.

Em 03/10/2026, readiness também foi validado no MariaDB 10.11 após as sete
migrations: HTTP 200 direto no back-end e pelo proxy Angular. Para este dialeto,
configurar `DATABASE_DIALECT=mariadb` antes de `npm run migration:deploy`.
