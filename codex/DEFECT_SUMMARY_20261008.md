# Indicadores globais e marco de resolução — 08/10/2026

Entrega autorizada pelo pedido de indicadores do inventário global. Produto
confirmou **criação até resolução**, base CREATED_TO_RESOLVED.

GET /api/v1/defects/summary agrega diretamente em SQL, após resolver membership,
grants atuais e visibilidade em todos os Workspaces ativos. Inclui projetos
arquivados e todo o histórico. Filtros e construção de query são compartilhados
com GET /defects: workspaceId/projectId/q/status/severity, padrão ALL. Resumo
não aceita paginação/ordenação/datas/categoria. Todos os estados/categorias vêm
com zero; nomes/categorias de ambiente são snapshots, sem reclassificação retroativa.

O inventário de defeitos passou a usar withInventoryScope, com bloqueios ordenados
de Workspace iguais às mutações de acesso. Listagem e agregado autorizam/contam
na mesma transação; escopo explicitamente não autorizado retorna 404. Sem grant
defect.read em Workspace explícito, não retorna um vazio que pareça autorizado.
A política opcional de grant de Workspace não altera os inventários de execuções
ou dashboard já entregues. Nenhum grant global/adicional foi criado.

Auditoria existente registra defect.status_changed sem payload de estado anterior
ou novo. Não permite reconstruir com certeza qual evento representa resolução.
Migration aditiva `202610080002_defect_resolution`, nas duas histórias, acrescenta
resolved_at DATETIME(3) nullable, **sem backfill**. updated_at e eventos de edição
não substituem resolução confiável. Sem mudança de JWT, timezone do banco ou DDL
destrutivo. Aplicar via migration:deploy antes de subir a API; banco real não alterado.

Nova transição a RESOLVED grava o instante UTC do servidor. Após ajuste solicitado
pelo produto em 08/10/2026, CLOSED preserva resolução existente ou registra o
instante do fechamento se ausente, incluindo RESOLVED legado com data null.
Reabrir para OPEN/IN_PROGRESS ou rejeitar limpa. Mesmo estado, edições, anexos e
referências preservam o marco. Tudo
usa transação e versão do defeito. CLOSED→RESOLVED registra nova resolução.

Média ponderada por defeitos individualmente: SUM das durações em microsegundos,
convertidas em horas, dividido por COUNT da amostra. Arredonda no final até duas
casas. Elegíveis: status atual RESOLVED/CLOSED, resolved_at não nulo e >=created_at.
Sem amostra: média null/amostra 0; duração 0 conta. Base mede tempo corrido desde a
criação original até resolução/conclusão do ciclo atual, mesmo após reabertura.
Fechamento direto é considerado conclusão e entra na amostra. Registros já
fechados sem marco permanecem null; sem backfill/migration adicional. A fonte é
nativa nesta versão, portanto resolutionTime retorna objeto. null reservado no
contrato para fonte indisponível; falhas HTTP nunca viram totais parciais/zeros.

Contrato: [guia do front](../front-specs/defect-summary.md), schemas explícitos
OpenAPI e resolvedAt aditivo nas respostas completas/inventário. OpenAPI: 186 operações.
Testes cobrem ciclo/no-op/versão/rollback/legados, edições/anexos, snapshots,
agregado global vs páginas/filtros, média ponderada, zero, vazio, datas negativas,
projetos arquivados, grants revogados, visibilidade, Workspaces e query inválida.
Verificação usa MySQL/MariaDB reais descartáveis; não acessa OCI nem envia e-mail real.

Validação concluída: build, typecheck e lint aprovados; 112 testes unitários/HTTP
e 123 testes de integração em cada dialeto (MySQL 8.4 e MariaDB 10.11).
Exemplos JSON, referências locais e 186 operationIds únicos conferidos.
