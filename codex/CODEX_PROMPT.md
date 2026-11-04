# Orientação inicial para o Codex

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](MARIADB_COMPATIBILITY.md).

## Estado atual: identidade, Workspace, Projetos, Casos de Teste Execução, Defeitos e Governança implementados

Em 30/09/2026 o usuário solicitou login, criação de usuários, códigos de
cadastro/redefinição por e-mail via SendGrid e Swagger para testes. Essa
entrega inclui o bootstrap necessário e identidade, a base já implementada.
A Fase 01 de Workspace foi solicitada e implementada em 02/10/2026.
A Fase 02 de Projetos foi solicitada e implementada (participantes, marcos e ambientes).
Fase 03 de Casos de Teste implementada em 02/10/2026. Fase 04 de Planos e Execuções implementada em 02/10/2026.
Fase 05 de Defeitos implementada em 02/10/2026. Fase 06 de Governança implementada em 03/10/2026. Requisitos e integrações permanecem pendentes. Solicitações futuras devem
seguir a fase/escopo pedido, mantendo documentação e front-specs atualizados.

Em 02/10/2026 a sequência foi revisada para seis fases: Workspaces, Projetos,
Casos de Teste, Planos e Execuções, Defeitos e Governança. Workspaces inclui
membros, convites, RBAC/grupos, campos personalizados, tags e anexos na
mesma fase. Shared parameters e Shared steps estão excluídos. Seguir o
plano principal e `WORKSPACE_DEVELOPMENT_PLAN.md`, sem usar a numeração antiga.

## Quando o usuário solicitar implementação

Implemente o backend do **Lambda Quality** seguindo os documentos deste
diretório e `../AGENTS.md`.

Leia primeiro `README.md` e depois, nesta ordem:

1. `BACKEND_ARCHITECTURE.md`
2. `DOMAIN_MODEL.md`
3. `ENTITIES.md`
4. `SECURITY_AND_TENANCY.md`
5. `DATABASE_MODEL.md`
6. `USE_CASES.md`
7. `API_SPEC.md`
8. `CODEX_IMPLEMENTATION_PLAN.md`

O bootstrap e a identidade já existem. Não recrie a aplicação nem implemente
fases futuras antecipadamente; continue o escopo solicitado pelo usuário.

Requisitos:

- Preservar o monólito modular.
- TypeScript `strict` e Node.js 24.x.
- NestJS e Prisma com versões estáveis compatíveis, fixadas no lockfile.
- MySQL 8.4 LTS e migrations SQL revisadas/versionadas.
- Não aplicar sincronização automática de schema.
- Vitest, Supertest e Testcontainers para Node.js/MySQL.
- Preparar o contrato de respostas e erros já no bootstrap.
- Preservar login, cadastro/redefinição por código, bearer e refresh token,
  com rotação, reuso detectável e revogação efetiva, conforme contratos.
- Nenhuma operação tenant-scoped busca recurso apenas pelo UUID sem
  validar Workspace e, quando aplicável, Project.
- Não alterar silenciosamente o modelo; documentar decisões relevantes.
- Para cada endpoint criado, alterado, descontinuado ou removido, atualizar
  `../front-specs/` na mesma entrega, seguindo seu README e modelo, com
  exemplos, tratamento de erros e orientações de integração para o front-end.
- Ao terminar a fase, executar as verificações disponíveis e apresentar
  arquivos alterados, decisões tomadas, resultados e pendências.

Pare ao final da fase solicitada para revisão.
