# Compatibilidade com MariaDB 10.11 — 03/10/2026

O usuário escolheu adaptar o back-end para o MariaDB 10.11 já configurado.
O diagnóstico confirmou conexão válida, banco vazio, sete migrations pendentes
e readiness 503. A decisão substitui a exigência de MySQL neste ambiente;
contratos HTTP, modelo, autenticação e regras tenant permanecem iguais.

## Histórico de migrações

Preservar `prisma/migrations` (MySQL) e seus checksums. Para banco MariaDB vazio,
usar `prisma/migrations-mariadb`, com os mesmos sete nomes e ordem, alterando
somente o SQL dependente do dialeto. `DATABASE_DIALECT=mariadb` seleciona esse
histórico em `prisma.config.ts`; valor ausente mantém `mysql` para compatibilidade.
Não alternar o histórico de um banco já inicializado nem usar reset/db push.

- `utf8mb4_0900_ai_ci` passa a `utf8mb4_unicode_nopad_ci`.
- `utf8mb4_0900_bin` passa a `utf8mb4_nopad_bin`.
- `REGEXP_LIKE` de Project.key passa a `REGEXP BINARY`, preservando ASCII/maiúsculas.
- UUIDs/hashes mantêm `ascii_bin`; índices, FKs compostas, grants e CHECKs permanecem.
- `DROP CHECK` passa a `DROP CONSTRAINT`, inclusive no upgrade do contador de defeitos.

As collations NO PAD foram consultadas no servidor 10.11.14. Preservam comparação
binária onde exigida e a distinção de espaços finais; a ordenação Unicode não é
idêntica à UCA 9 do MySQL. Nomes/chaves continuam normalizados na aplicação.
MariaDB representa JSON como LONGTEXT validado; testar valores escalares,
SQL NULL/JSON null e snapshots pelos adapters e pela API, sem remover CHECKs.
Referências: [JSON](https://mariadb.com/docs/server/reference/data-types/string-data-types/json),
[ALTER TABLE](https://mariadb.com/docs/server/reference/sql-statements/data-definition/alter/alter-table).

## Manutenção e verificação

Ao criar uma migration MySQL, adicionar sua equivalente MariaDB. Um teste compara
ambas as sequências com as substituições declaradas, impedindo ausência ou alteração
silenciosa de constraints. A suíte de integração seleciona o dialeto explicitamente,
verifica a versão real, usa schemas descartáveis prefixados e cobre criação e upgrade
com dados de todas as fases. Mocks de e-mail e storage não enviam mensagens reais.

Antes de aplicar ao banco da aplicação: build, lint, tipos, unidade e integração;
confirmar que o banco alvo continua vazio. Aplicar com `npm run migration:deploy`,
consultar `migration:status` e confirmar `/api/v1/health/ready` direto e pelo proxy.
DDL não tem rollback automático; interromper em erro, inspecionar schema/histórico
e reparar o que foi aplicado antes de retomar. Não redefinir um banco com dados.

## Validação concluída

Node.js 24.15.0: build, lint e tipos passaram. Os 45 testes unitários e 67 testes
de integração passaram no MariaDB 10.11.14 configurado, em bancos temporários
separados. A integração verificou o bootstrap e as atualizações com dados até
Governança; envio de e-mail e storage foram simulados.

No banco da aplicação, confirmado vazio antes do deploy, as sete migrations foram
aplicadas com sucesso e `migration:status` confirmou o schema atualizado.
`db:check` confirmou conexão MariaDB e 47 tabelas, incluindo `_prisma_migrations`.
O readiness retornou HTTP 200 em `localhost:3000/api/v1/health/ready` e pelo proxy
Angular em `localhost:4200/api/v1/health/ready`. O cadastro real e o envio SendGrid
não foram disparados nesta validação.

## Evolução do dashboard — 04/10/2026

Os sete registros originais foram preservados; o histórico atual inclui também
`202610040007_dashboard_indexes`, com três índices aditivos e SQL idêntico nos
históricos MySQL/MariaDB. Aplicar essa evolução com migrate deploy no histórico
do banco existente, sem reset e sem exigir banco vazio. O requisito de banco
vazio acima descreve exclusivamente o bootstrap original. JSON_TABLE usado
na visibilidade histórica das metas foi validado com as projeções em MariaDB
10.11.14 e MySQL 8.4.11 descartáveis.

## Metas e ambientes — 04/10/2026

Histórico atual inclui também `202610040008_framework_progress_goals` e `202610040009_defect_environments`; dez migrations ao todo, sem alteração das originais. Evoluções aditivas, SQL equivalente nas duas histórias. Seleção de avaliação usa ROW_NUMBER; resumo usa projeções JSON e agregação COUNT/GROUP BY. Validar/aplicar no DATABASE_DIALECT do banco existente, sem reset.
