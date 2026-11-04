# Acompanhamento de frameworks e metas por seção — 04/10/2026

Solicitação adicional autorizada após a Fase 06. Mantém classificações e
snapshots existentes; não antecipa requisitos/integrações.

- Progresso e dashboard compartilham projeções tenant-scoped, seleção e
  fórmulas. Seleção: IN_PROGRESS por createdAt DESC/id ASC; sem ela,
  CLOSED por closedAt DESC/id ASC. DRAFT somente por escolha explícita.
- Árvore, pesos e classificações pertencem ao snapshot selecionado. Resumos
  diretos/subárvores não se somam no consolidado. GET não escreve nem calcula metas.
- Metas aceitam sectionId e ownerMemberId nulos. Atribuição exige membro
  ativo do Workspace. Nome público do responsável não inclui e-mail.
- Cálculo de GOVERNANCE_SCORE permanece na última CLOSED, com desempate por
  ID ascendente; seção ausente não usa fonte antiga. lastResult guarda
  seção/nome/caminho históricos (section) e reason quando sem base. Na leitura,
  sectionName/sectionPath usam esse snapshot após cálculo; antes dele, a
  definição atual. Snapshot ausente produz null/[], sem fallback de nome.
- Edição conserva a regra atual de invalidar lastResult e incrementar versão.
  Apenas atribuições explícitas de responsável revalidam status ativo, para
  permitir editar metas cujo antigo responsável foi removido; seu nome fica null.
- Alertas usam data UTC de negócio: evidência expirada antes de hoje; metas
  ativas visíveis vencendo de hoje a hoje+30 dias, inclusive, sem limite de cartões.
- Nova migration aditiva nas duas histórias adiciona campos opcionais e FKs
  compostas de tenant/seção e responsável. Metas antigas recebem null.

Contratos: [acompanhamento](../front-specs/framework-progress.md),
[governança](../front-specs/governance.md), [dashboard](../front-specs/dashboard.md).

## Verificação da entrega

- Node.js 24.15.0: build, TypeScript strict e lint aprovados.
- 53 testes unitários/HTTP aprovados; OpenAPI regenerado, 172 operações.
- Regressão completa: 86 testes em MySQL 8.4.11 descartável; cenário adicional
  de 12 frameworks/consolidado/desempate aprovado em execução focada (87 testes
  de integração distintos validados). A fixture usa limite de 10000 chamadas
  para comportar a suíte, sem mudar limites da aplicação.
- MariaDB 10.11.14 descartável: 25 testes focados de governança/dashboard/
  ambientes, mais o cenário adicional de consolidação, aprovados.
- Migrations testadas com dados anteriores: metas mantêm valor/versão e recebem
  IDs nulos; defeitos anteriores preservados sem ambiente. FKs tenant-scoped,
  snapshots, grants atuais, queries inválidas e GET sem escrita verificados.
- 389 exemplos JSON válidos e referências locais existentes. Comparação
  semântica do OpenAPI preserva todos os campos/obrigações anteriores; mudanças
  aditivas nas metas, ambientes, defeitos, dashboard e leituras novas.
- Nenhuma migration foi aplicada ao banco configurado da aplicação nesta entrega;
  aplicar migrate deploy no histórico correto e reiniciar API para disponibilizar.
  E-mail/armazenamento são simulados nos testes; interface do front não foi alterada.
