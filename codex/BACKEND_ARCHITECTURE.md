# Arquitetura do backend

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](MARIADB_COMPATIBILITY.md).

## Estilo e stack

Monólito modular orientado a domínio, em TypeScript `strict` sobre Node.js
24.x. NestJS organiza módulos, injeção de dependências e transporte HTTP;
Prisma implementa adapters de persistência em MySQL 8.4 LTS.

```text
src/
├── modules/
│   ├── identity
│   ├── workspace
│   ├── project
│   ├── testmanagement
│   ├── execution
│   ├── requirement
│   ├── defect
│   ├── governance
│   ├── attachment
│   ├── integration
│   └── audit
└── shared/
prisma/
└── migrations/
test/
```

Cada módulo pode conter `domain/`, `application/`, `infrastructure/` e
`api/`. As camadas internas dependem de contratos, sem importar NestJS,
Prisma ou DTOs HTTP. Interfaces de ports usam tokens explícitos de injeção
na composição, pois interfaces TypeScript não existem em runtime.

## Responsabilidades

- **identity:** usuários, senhas, autenticação, sessões e tokens.
- **workspace:** tenant, members, invitations, groups, roles e permissions.
- **project:** projects, members, milestones e environments.
- **testmanagement:** suites, cases, steps e tags.
- **execution:** plans, runs, snapshots e resultados.
- **requirement:** requisitos e rastreabilidade.
- **defect:** defeitos e vínculos externos.
- **governance:** frameworks, controls, assessments, evidence, goals e action plans.
- **attachment:** arquivos/metadados.
- **integration:** pipelines e sistemas externos.
- **audit:** trilha imutável.
- **shared:** contratos e infraestrutura transversal; não centralizar regras de domínio.

## Regras

- Controller adapta HTTP; regras de negócio pertencem a Use Cases/domínio.
- Preferir Use Cases pequenos a Services gigantes.
- Módulos não acessam repositories internos uns dos outros; comunicação
  por ports públicos/eventos, sem ciclos de dependência.
- DTOs de entrada e saída explícitos; não serializar registros Prisma
  diretamente, especialmente User, AuthSession e RefreshToken.
- Validar configuração e payloads em runtime; rejeitar campos inesperados.
- UUID para IDs técnicos; `sequence` para IDs humanos.
- Migrations são a única fonte de evolução do schema; não sincronizar
  tabelas automaticamente nem substituir migrations por push de schema.
- Datas em UTC: `Date` na aplicação, `DATETIME(3)` no MySQL e ISO 8601 com
  offset `-03:00` nas respostas HTTP (atualização de 06/10/2026). Datas de calendário usam `DATE` e `YYYY-MM-DD`.
- Histórico não pode mudar quando a definição atual muda.
- Logs estruturados com `requestId`, sem credenciais ou tokens.

## Multi-tenancy e autenticação

`Workspace` é a fronteira lógica. User e sessões de identidade são globais;
membership e permissões são resolvidos para cada Workspace solicitado.

```text
Request → Bearer Authentication + Active Session → Workspace Context
        → Authorization → Use Case → Tenant-aware Repository → MySQL
```

Todo recurso tenant-scoped carrega `workspaceId`. Nenhuma busca de negócio
tenant-scoped confia apenas no UUID. A URL define o Workspace solicitado;
o servidor valida membership atual, estado do Workspace e escopo de Project.
Claims JWT não substituem essa verificação.

## Persistência

MySQL 8.4 LTS/InnoDB; constraints e FKs compostas para isolamento;
índices por `workspace_id`; transações explícitas; controle otimista por
`version` quando necessário; archive/soft-delete para objetos históricos.
Integração e migrations são verificadas com Testcontainers e MySQL real.

Schema e SQL ficam em `prisma/`. Os comandos de geração/aplicação devem
seguir a versão Prisma fixada no bootstrap; expô-los em scripts npm e
documentar sua finalidade, sem usar comandos de desenvolvimento em produção.

## API

Base `/api/v1`; recursos preferencialmente sob
`/api/v1/workspaces/{workspaceId}/projects/{projectId}/...`.
Autenticação sob `/api/v1/auth`. Filtros de exceção e interceptors aplicam
o contrato de `API_SPEC.md`, incluindo erros emitidos por guards,
validação, rotas inexistentes e falhas inesperadas.

## Testes

Vitest para domínio/use cases; Supertest para HTTP; Testcontainers para
MySQL. Cobrir autenticação, rotação concorrente/reuso, autorização,
cross-tenant, migrations, snapshots de Run e regras de dependência entre
módulos. Testes unitários não dependem de container; integração não usa
SQLite como substituto de MySQL.
