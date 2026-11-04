# Ambientes em defeitos e indicadores — 04/10/2026

Extensão autorizada durante o acompanhamento de frameworks. Ambientes já
existem por projeto; preservar o cadastro e os cinco endpoints atuais.

- Categoria explícita PRODUCTION/HOMOLOGATION/OTHER, padrão OTHER para cadastros
  existentes/novos que omitem o campo. Não inferir categoria pelo nome.
- Defeitos recebem environmentId opcional e snapshot de nome/categoria.
  Criação avulsa sem ambiente continua permitida. Legado fica null; não atribuir
  produção/homologação retrospectivamente sem dados.
- Origem de falha herda o ambiente da execução se o campo for omitido, inclusive
  ambiente hoje inativo/excluído logicamente. Nome vem do snapshot da execução;
  categoria vem do cadastro na associação ao defeito. null impede herança;
  UUID explícito exige ambiente ativo/não excluído do mesmo tenant/projeto.
- PATCH versionado pode remover/substituir ambiente; associação explícita
  copia novo snapshot. Editar cadastro não altera defeitos/snapshots de execução.
- Uma consulta agregada por Workspace, opcionalmente projeto/categoria, fornece
  mês, totais, situações, projetos e ambientes do escopo atual autorizado.
  Projetos arquivados acessíveis entram no relatório histórico.
- Datas inclusivas UTC de criação, até 36 meses; situações são atuais dos bugs
  criados naquele intervalo. Não representa quantidade de encerramentos no mês
  nem reconstrução da situação em uma data passada. RESOLVED e REJECTED separados.
- Agrupar categorias entre projetos; ambiente por UUID/projeto/nome/categoria
  do snapshot. Mudança explícita de associação atualiza a atribuição do defeito.
- Sem paginação/fanout de definições completas; uma consulta SQL COUNT GROUP BY.
  FKs compostas e índices nas duas histórias; nenhuma nova permission.

Guia para a área do front e gráficos: [ambientes e indicadores](../front-specs/defect-analytics.md).

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
