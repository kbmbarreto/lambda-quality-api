# Orientações para agentes — Lambda Quality API

Desde 04/11/2026: identidade Lambda Quality, iniciativa open source da Lambda
Team sob licença MIT. Esta entrega usa instalação nova, sem migração de dados
anteriores. Seguir `codex/PRODUCT_IDENTITY.md` para nomes e compatibilidade.

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](codex/MARIADB_COMPATIBILITY.md).

## Escopo atual

O projeto iniciou a implementação em 30/09/2026. A entrega autorizada inclui
bootstrap, Swagger e identidade: cadastro com código por e-mail, login,
refresh/logout e redefinição de senha via SendGrid. A Fase 01 de Workspace
foi solicitada em 02/10/2026 e implementada: membros/convites, ownership,
RBAC/grupos, campos personalizados, tags e anexos privados. A Fase 02 de
Projetos foi solicitada e implementada, incluindo participantes, marcos e
ambientes. A Fase 03 de Casos de Teste foi solicitada e implementada, com suítes,
casos/passos, valores personalizados e vínculos a tags/anexos. A Fase 04 de
Planos e Execuções foi solicitada e implementada, com planos,
execuções manuais, resultados, comentários e snapshots imutáveis. A Fase 05
de Defeitos foi solicitada e implementada: criação avulsa/por falha, estados,
referências externas e anexos privados. A Fase 06 de Governança foi solicitada e implementada em 03/10/2026:
frameworks/seções/controles, avaliações e evidências históricas, metas, ações
e dashboard interno. Requisitos e integrações permanecem pendentes; não antecipá-los.

O planejamento revisado em 02/10/2026 segue: Workspaces, Projetos, Casos de
Teste, Planos e Execuções, Defeitos e Governança. Workspaces é uma fase única
com membros, convites, roles, grupos, campos personalizados, tags e anexos.
Shared parameters e Shared steps foram excluídos; TestStep próprio de cada
caso permanece. Consultar `codex/WORKSPACE_DEVELOPMENT_PLAN.md` para limites
e dependências. Revisão do plano não significa implementação entregue.

Quando a implementação for solicitada, siga `codex/CODEX_PROMPT.md` e
`codex/CODEX_IMPLEMENTATION_PLAN.md`, execute apenas a fase solicitada e
pare ao final dela para revisão.

## Fontes de orientação

Leia `codex/README.md` e os documentos na ordem indicada nele. A visão em
`codex/Lambda_Quality_Ideias_Iniciais.md` é conceitual; os contratos técnicos
regem a implementação. Documente conflitos e decisões em vez de alterar o
modelo silenciosamente.

## Requisitos

- TypeScript `strict`, Node.js 24.x e MySQL 8, baseline 8.4 LTS.
- Preservar o monólito modular, domínio independente de NestJS/Prisma e
  migrations SQL versionadas.
- Usar JWT bearer para acesso e refresh token opaco rotativo, conforme
  `codex/SECURITY_AND_TENANCY.md`.
- Seguir os envelopes de sucesso e Problem Details em `codex/API_SPEC.md`;
  DTOs explícitos, mensagens em pt-BR e códigos de erro estáveis.
- Buscar recursos tenant-scoped por ID e Workspace; validar Project
  quando aplicável. Nunca autorizar apenas pelo UUID ou claims de roles.
- Preservar snapshots de execução e avaliação e não registrar segredos.
- Identificadores e código em inglês; documentação e mensagens em português.

## Documentação para o front-end

Toda criação, alteração, descontinuação ou remoção de endpoint deve atualizar
`front-specs/` na mesma entrega, incluindo o índice em `front-specs/README.md`.
Usar `front-specs/ENDPOINT_TEMPLATE.md`, com uma seção por endpoint no guia
da funcionalidade. Documentar contrato real, acesso, exemplos, erros e
fluxo de integração; registrar impactos de compatibilidade. Manter guias,
OpenAPI e implementação consistentes, sem apresentar rotas planejadas como
disponíveis. Essa documentação integra o aceite de cada fase com endpoints.

## Verificação

Durante revisão documental, verificar referências, exemplos JSON e
consistência entre documentos. Não alegar build/testes de uma aplicação
que ainda não existe.

Na implementação, executar os scripts de lint, tipos, build e testes
relevantes; usar MySQL real em integração e testar isolamento entre tenants.
Relatar alterações, decisões e limitações de validação. Não criar commits
ou publicar alterações sem solicitação.
