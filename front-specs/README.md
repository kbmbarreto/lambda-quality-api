# Instruções de integração para o front-end

Atualização de 04/11/2026: identidade **Lambda Quality**, projeto open source
da Lambda Team sob licença MIT. Todos os erros agora usam
`urn:lambdaquality:problem:<tipo>`; integrar pelo campo `code`.
JUnit usa `lambdaquality.caseId` e `lambdaquality.humanId`.
Confira os [impactos de compatibilidade](../codex/PRODUCT_IDENTITY.md),
o [guia de importação](execution-imports-and-inventories.md) e o [OpenAPI](openapi.json).

Atualização de 08/10/2026: operações autenticadas sem quota geral de requisições.
Login/cadastro/refresh/redefinição e cooldown de reenvio de convites mantêm
proteções específicas; me/logout/logout-all ficam fora da quota. Guias por
endpoint e [OpenAPI](openapi.json) atualizados. [Cofre: configuração e diagnóstico](test-vault.md).


Atualização de 08/10/2026: [JUnit auditável, inclusão atômica em lote e inventários
paginados de execuções/projetos](execution-imports-and-inventories.md). Seis
novas rotas; casos de execução recebem origem MANUAL/JUNIT. Aplicar migration
`202610080001_result_imports` antes de iniciar esta versão.

> Atualização de 03/10/2026: MariaDB 10.11 autorizado neste ambiente.
> Seleção de migrations por `DATABASE_DIALECT`; histórico MySQL preservado.
> Ver [compatibilidade](../codex/MARIADB_COMPATIBILITY.md).

Esta pasta reúne as instruções de consumo dos endpoints do Lambda Quality.
Cada endpoint criado, alterado, descontinuado ou removido deve ter seu guia
atualizado **na mesma entrega**, junto à implementação e ao OpenAPI.

## Evoluções de 06/10/2026

- [Instruções das telas: Defeitos, importação, cofre, datas e controles](product-improvements.md).
- [Inventário paginado entre Workspaces/projetos autorizados](defect-inventory.md).
- [Importação de casos Azure DevOps CSV](azure-test-case-import.md).
- [Cofre criptografado por projeto e revelação auditada](test-vault.md).
- Timestamps de **todas as respostas**, inclusive sucesso/Problem Details/snapshots
  apresentados pela API, agora usam -03:00 preservando o instante UTC. DATE permanece
  YYYY-MM-DD. Não subtrair horas no front; orientações anteriores sobre Z são substituídas
  por esta regra. OpenAPI: 179 operações.

## Estado atual

Disponíveis nesta entrega: cadastro/recuperação por código de e-mail,
login, tokens, logout, perfil e saúde; Workspace, membros, convites, roles,
grupos, campos personalizados, tags e anexos privados; projetos, participantes,
marcos e ambientes; suítes, casos de teste, passos e valores/vínculos; planos e execuções manuais; defeitos e vínculos de falha/anexos; frameworks, avaliações, evidências, metas, ações e dashboard de governança; visão geral consolidada do produto. O índice abaixo identifica os guias
entregues. Os demais contratos em [API_SPEC.md](../codex/API_SPEC.md)
permanecem planejados; sua presença não indica disponibilidade.

## Organização

- Um arquivo por módulo/funcionalidade, por exemplo `authentication.md`,
  `workspaces.md` ou `projects.md`, criado quando houver entrega correspondente.
- Dentro do arquivo, uma seção por endpoint, identificada por método e
  caminho completo, seguindo [ENDPOINT_TEMPLATE.md](ENDPOINT_TEMPLATE.md).
- Reutilizar o arquivo existente ao alterar um endpoint; registrar impacto
  de compatibilidade e instruções de adaptação para o consumidor.
- Manter o índice abaixo atualizado, com links para os guias entregues.

## Conteúdo obrigatório por endpoint

1. Objetivo, disponibilidade, versão da API e fluxo/tela em que será usado.
2. Método HTTP, caminho completo, autenticação e permissões necessárias.
3. Parâmetros de rota/query, headers e body: tipos, obrigatoriedade,
   formatos, valores padrão, limites, enums e comportamento de nulos.
4. Exemplos reais e anonimizados de requisição, sucesso e erros relevantes,
   com status HTTP, headers e códigos estáveis.
5. Paginação, filtros, ordenação e casos vazios, quando aplicáveis.
6. Orientação para loading, sucesso, validação por campo, erro e nova tentativa;
   efeitos sobre navegação, cache e dados exibidos após a operação.
7. Regras importantes para o consumidor, incluindo tenant, snapshots,
   idempotência e concorrência quando aplicáveis.
8. Alterações de contrato, compatibilidade, limitações e referências ao
   OpenAPI e à verificação da entrega.

Se um item não se aplicar, indicar isso explicitamente. Não inventar campos,
permissões, endpoints ou comportamentos ainda não implementados.

## Convenções compartilhadas

Os guias devem seguir [API_SPEC.md](../codex/API_SPEC.md) e
[SECURITY_AND_TENANCY.md](../codex/SECURITY_AND_TENANCY.md):

- Base `/api/v1`; mensagens pt-BR, campos/códigos em inglês e timestamps com offset -03:00.
- Sucesso JSON usa `data`, `message` e `meta`; 204 não possui corpo para parse.
- Erros usam Problem Details; tratar `code`/HTTP, sem depender do texto da
  mensagem. Usar `errors` para campos e `requestId` para investigação.
- 403 indica permissão insuficiente no escopo visível; 404 não confirma
  existência de recursos em outros tenants.
- Após implementar autenticação, enviar access token como bearer.
  Renovar apenas nos cenários previstos no contrato; não renovar em loop
  para qualquer 401. Revogação, expiração da sessão ou reuso exigem novo login.
- Executar uma única renovação por vez; não repetir refresh cegamente após
  timeout. Tokens de navegador permanecem em memória, conforme contrato atual.
- Incluir Workspace/Project em chaves de cache quando aplicáveis; limpar
  dados do escopo anterior na troca de Workspace e no logout.
- Exemplos não contêm senhas, tokens, dados pessoais ou URLs de produção
  reais. Usar placeholders somente para valores sensíveis/configuráveis.

O guia explica a integração com o contrato implementado e complementa o
OpenAPI. Havendo divergência, corrigir implementação/contrato/documentação
antes de declarar a entrega concluída. Exemplos de consumo devem respeitar
a stack do front-end quando ela for definida; esta pasta não a escolhe.

## Índice de funcionalidades entregues

- [Autenticação e criação de usuários](authentication.md).
- [Saúde e disponibilidade](health.md).
- [Contratos e fluxos compartilhados de Workspace](workspace-contracts.md).
- [Workspaces, membros, ownership e convites](workspaces.md) — 15 endpoints.
- [Permissões, roles e grupos](workspace-access.md) — 18 endpoints.
- [Campos personalizados e tags](workspace-catalogs.md) — 10 endpoints.
- [Biblioteca de anexos privados](workspace-attachments.md) — 5 endpoints;
  atualização de 04/10/2026: armazenamento no Oracle OCI, mantendo multipart
  e download privado pela API.
  Em 05/10/2026, falhas de PEM/OCI permitem startup e retornam `503` com mensagem
  ao tentar anexar/baixar; orientar o front pelo `detail`, sem renovar sessão.
- [Contratos e fluxos de Projetos](project-contracts.md).
- [Projetos, participantes, marcos e ambientes](projects.md) — 19 endpoints.
- [Contratos de Casos de Teste](test-case-contracts.md).
- [Suítes, casos, passos, campos e vínculos](test-cases.md) — 26 endpoints, incluindo contagens diretas por suíte (`test-cases/summary`).
- [Contratos de Planos e Execuções](execution-contracts.md).
- [Planos, execuções, resultados e comentários](execution.md) — 24 endpoints originais, mais [JUnit, seleção em lote e inventário de execuções](execution-imports-and-inventories.md).
- [Contratos de Defeitos](defect-contracts.md).
- [Comentários e histórico completo de defeitos](defect-history.md) — PATCH com comment e GET /history, disponíveis em 09/10/2026; limitações da auditoria legada documentadas.
- [Indicadores globais do inventário e tempo de correção](defect-summary.md) — GET /defects/summary, histórico completo e resolvedAt em 08/10/2026; fechamento também registra o marco quando ausente.
- [Defeitos, estados e vínculos](defects.md) — 10 endpoints originais, incluindo [indicadores por ambiente](defect-analytics.md), mais [histórico de defeitos](defect-history.md).
- [Conclusão das metas por ações](goal-action-completion.md) — regra e integração atualizadas em 07/10/2026; sem nova rota.
- [Contratos de Governança](governance-contracts.md).
- [Governança, avaliações, metas e ações](governance.md) — 33 endpoints, incluindo [acompanhamento e metas por seção](framework-progress.md); PATCH permite vincular ações existentes a metas desde 07/10/2026.
- [Projetos completos paginados e indicadores](execution-imports-and-inventories.md#get-apiv1dashboardprojects) — novo inventário do Início.
- [Visão geral consolidada do produto](dashboard.md) — 1 endpoint, disponível em 04/10/2026; automação, total global ACTIVE e janela ALL disponíveis em 07/10/2026.
- [Snapshot OpenAPI da entrega](openapi.json) — 187 operações no total;
  contrato ao vivo em `/docs-json`.

Comece por `workspace-contracts.md`. Os guias documentam cada endpoint com
payloads, paginação, permissões e erros. Para Projetos, leia também
`project-contracts.md`: acesso combina permissions de Workspace e role local.
Casos de Teste estão disponíveis na Fase 03; leia `test-case-contracts.md`. Shared parameters/Shared steps
estão excluídos. Os testes de e-mail usam mock; a caixa postal não é validada
por essa verificação automatizada.

Planos e Execuções estão disponíveis na Fase 04; leia `execution-contracts.md`.
Defeitos disponíveis na Fase 05; leia `defect-contracts.md`.
Governança disponível na Fase 06; leia `governance-contracts.md`.
Requisitos e integrações permanecem planejados.

- [Ambientes, associação no defeito e gráficos de bugs](defect-analytics.md) — área de cadastro para o front e nova leitura agregada por Workspace; Defeitos passa a 10 endpoints.
