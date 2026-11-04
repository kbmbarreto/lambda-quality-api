# Governança — decisões da Fase 06

Entrega autorizada em 03/10/2026: frameworks, seções, controles, avaliações,
evidências, metas, ações e dashboard. Requisitos, integrações e certificação
oficial permanecem fora do escopo.

## Contratos adotados antes da implementação

- Governança é do Workspace. `governance.read`, `governance.assess` e
  `governance.manage` são grants atuais do banco; Owner recebe todos,
  Administrator recebe os três, Member recebe somente leitura. Roles locais
  de Projeto permanecem iguais. Meta de Projeto exige visibilidade atual do
  Projeto; seu cálculo também exige a capacidade de leitura da fonte.
- Framework nasce DRAFT, pode tornar-se ACTIVE quando tem ao menos um controle
  ativo, e ARCHIVED é terminal. Definições podem evoluir em DRAFT/ACTIVE.
  Seções têm posição explícita, ordenação estável por posição/ID, código único
  por framework, profundidade máxima 20 e proibição de ciclos. Sem exclusão
  física de definições; controles podem ser desativados.
- Framework, Assessment, Goal e ActionPlan usam versão otimista positiva.
  Escritas em filhos exigem/incrementam a versão do agregado. Mutação e audit
  são atômicos sob a transação serializada do Workspace.
- Avaliação nasce DRAFT somente de framework ACTIVE com controles ativos.
  Copia imediatamente nome/código/versão, árvore de seções e definições dos
  controles ativos. Edição posterior do framework não altera essa cópia.
  DRAFT → IN_PROGRESS → CLOSED; resultados/evidências só em IN_PROGRESS.
  CLOSED é terminal, sem reabertura ou edição. Fechamento exige todos os
  controles avaliados e justificativa não vazia para N/A.
- Índice interno: NOT_MET=0, PARTIALLY_MET=50, MET=100; NOT_ASSESSED=0 na
  prévia e bloqueia fechamento; N/A excluído do denominador. Peso positivo
  padrão 1 (máximo 1000), média ponderada arredondada a duas casas, null
  quando nenhum controle aplicável. Score é derivado, não recebido do cliente,
  e não representa conformidade oficial ou certificação.
- Evidências suportam ATTACHMENT (referenceId aponta anexo privado existente)
  e URL HTTP/HTTPS absoluta sem credenciais, sem consulta remota. Tipos são
  mutuamente exclusivos. Metadados do arquivo são copiados, sem storageKey;
  exclusão do arquivo não destrói a evidência histórica. Inclusão/leitura de
  evidências de arquivo exigem attachment.read; download mantém autorização
  própria. validUntil é uma data, expiração gera atenção sem invalidar o
  resultado manual nem impedir fechamento. Até 100 evidências por controle.
- Metas disponíveis: AUTOMATION_COVERAGE (casos ACTIVE, automationStatus
  AUTOMATED / todos os ativos), CRITICAL_DEFECTS (CRITICAL ou BLOCKER,
  OPEN/IN_PROGRESS), GOVERNANCE_SCORE (última avaliação CLOSED de framework
  selecionado; desempate closedAt/ID). Operadores GT/GTE/EQ/LTE/LT.
  GOVERNANCE_SCORE tem frameworkId obrigatório e projectId nulo; as outras
  podem ter Projeto ou Workspace. Requirements e flaky não são tipos disponíveis.
- Cálculo usa strategies públicas e grava valor, numerador/denominador,
  instante, fontes e status. Fonte vazia para cobertura/score retorna valor
  null e não cumpre a meta. Com valor válido: ACHIEVED se comparação cumpre;
  MISSED se não cumpre e prazo UTC já passou; ACTIVE nos demais casos.
  Recalcular é explícito, inclusive metas ACHIEVED/MISSED; CANCELLED é terminal.
  Alterar critério/escopo de meta limpa o resultado anterior e volta a ACTIVE.
- Métrica de Workspace considera todos os Projetos ACTIVE, nunca uma amostra
  dos visíveis. Exige visibilidade e capacidade da fonte em cada Projeto,
  ou falha com 403. Leitura da meta de Workspace também valida todos os Projetos
  atuais e sourceIds históricos; listas/dashboard ocultam o agregado sem acesso.
  Projeto arquivado bloqueia escrita/cálculo da meta, mas
  permite leitura histórica. Métricas usam portas públicas dos módulos fonte.
- Ações podem vincular avaliação de controle, meta, ambas ou nenhuma;
  controlAssessmentId imutável depois de criado. goalId editável desde
  07/10/2026 conforme extensão abaixo. ownerMemberId deve ser membro ACTIVE do tenant.
  Ação em avaliação CLOSED pode evoluir independentemente sem editar histórico.
  OPEN/IN_PROGRESS → DONE ou CANCELLED são terminais. DONE apenas pelo endpoint
  complete. Escrita de ação ligada a meta de Projeto exige Projeto ativo.
- Dashboard agrega avaliações/índices internos e metas/ações visíveis, sem
  calcular métricas automaticamente. Filtro de visibilidade precede contagem
  e paginação de metas/ações; nenhum total de Projeto oculto é exposto.
- Datas são calendárias ISO reais YYYY-MM-DD; timestamps UTC. Códigos de
  seções/framework/controles são ASCII maiúsculos [A-Z0-9_.-] de 1–50 caracteres.
  Nomes até 100, títulos até 250, textos até 10000; limites framework: 500
  seções/1000 controles. Todos os IDs de rota são UUID v4 e listas paginadas.
- Migration incremental preserva módulos e grants personalizados existentes;
  FKs compostas protegem Workspace/Framework/Assessment/Projeto e arquivos.
  Migrations não são aplicadas ao banco configurado sem solicitação.

## Validação da entrega

- Node.js 24.15.0; lint, typecheck e build aprovados.
- Suíte completa: **110 testes aprovados**, 43 unitários/HTTP e 67 com MySQL
  8.4.11 real. Inclui banco vazio e upgrade incremental da Fase 05 com
  execução/resultados/snapshots/comentários/defeitos/anexos e grants preservados.
- Integração cobre histórico independente, fechamento imutável, N/A,
  snapshots de controles/seções/pesos, evidência privada/excluída, ciclo,
  concorrência/version, FKs compostas, isolamento, revogação de grants,
  fontes/cálculos reais, metas sem fonte/canceladas/vencidas, ações e dashboard.
- Um teste existente de Execuções apresentou socket hang up na primeira suíte
  completa. O harness passou a manter um listener HTTP em loopback durante
  a suíte, evitando abrir/fechar um servidor por requisição; a repetição
  completa passou, sem retries automáticos ou alteração de resultados.
- OpenAPI: **168 operações**, 32 novas. As 136 operações anteriores mantêm
  contratos; cinco schemas compartilhados ampliam enums de permissions.
- Documentação: 375 exemplos JSON válidos, payloads/respostas dos 32 endpoints
  conferidos contra schemas OpenAPI, 758 referências locais verificadas.
- Migration revisada com índices explícitos para FKs; grants de sistema
  ampliados, customizados preservados. Banco configurado não foi migrado;
  validação usa somente containers/esquemas descartáveis.
- Nenhum commit/publicação. Requisitos, integrações, metas de flaky/requisitos,
  framework oficial pré-carregado e certificação permanecem fora da entrega.

## Vínculo de ação existente a meta — 07/10/2026

- Pedido autoriza rever a imutabilidade de goalId: PATCH de ação OPEN/IN_PROGRESS
  aceita UUID v4 para associar/trocar, null para remover e ausência para manter.
  Uma ação admite uma meta, meta admite várias ações; sem associação em lote.
  controlAssessmentId e snapshots/avaliações continuam imutáveis.
- Version otimista é da ação. Mutação e auditoria governance.action.updated
  são atômicas. Na extensão posterior de conclusão, atualiza também
  status/version da meta; lastResult continua preservado.
- Reutiliza governance.manage e autorização de origem/destino no tenant.
  Valida destino por findGoal com escrita: cancelado 409, projeto arquivado
  409 e invisível/outro tenant 404. Meta já vinculada cancelada não bloqueia
  o ciclo da ação; origem com projeto arquivado continua bloqueando escrita.
  Ações DONE/CANCELLED mantêm estado terminal.
- goal_id/FK composta/índice já atendem ao fluxo. Sem migration, grant ou rota
  adicional. GET/lista por goalId e dashboard existentes refletem o vínculo
  e sua visibilidade. Contratos e OpenAPI ampliam apenas o PATCH existente.

### Verificação do vínculo de ações

- Node.js 24.15.0: build, tipos e lint aprovados; 92 testes unitários/HTTP.
- Suíte completa: 102 testes de integração aprovados em MySQL 8.4.11 e os
  mesmos 102 em MariaDB 10.11.14, usando bancos descartáveis.
- Cobertura: associação, troca, remoção, campo ausente, estados terminais,
  meta cancelada, UUID/version, permissão, projeto invisível
  ou arquivado de origem/destino, ação/meta de outro tenant, atomicidade,
  auditoria e preservação da avaliação CLOSED e lastResult da meta.
- OpenAPI permanece com 179 operações, ampliando UpdateActionDto.goalId
  e descrição da operação updateGovernanceAction. Demais rotas/schemas
  preservados. Banco da aplicação não alterado; sem commit/publicação.

## Conclusão de metas por ações — 07/10/2026

O usuário confirmou que a meta não é auditada e que concluir todas as ações
deve atingir a meta, sem impactar o framework. Esta decisão substitui o
atingimento por comparação de lastResult descrito na Fase 06 acima.

- Todos os tipos usam DONE / ações não CANCELLED, sem base null. Atinge
  somente com base positiva e todas DONE. Pendência/sem base: ACTIVE ou
  MISSED conforme prazo UTC; CANCELLED da meta é preservado.
- actionProgress adicional em GoalResponse/overview; progress/status/detail
  do cartão usam ações. lastResult e critérios permanecem como informação
  técnica e só são calculados pelo comando explícito existente.
- SQL em lote por Workspace/meta autorizada, sem carregar definições de
  ações. Limites/status/paginação após derivação; banco legado funciona na
  primeira leitura sem backfill nem escrita em GET.
- Criar/mudar vínculo/status/concluir ação sincroniza situação/version das
  metas não canceladas na mesma transação, com auditoria de meta. Metas de
  origem/destino já devem estar autorizadas. lastResult não é modificado.
- Nova pendência reabre a meta; cancelar pendência pode atingir, mas cancelar
  todas não atinge. Avaliações/frameworks e snapshots nunca são modificados.
- Sem migration/grant/rota nova. Front deve reconsultar metas e suas versões
  após operações de ações. [Contrato](../front-specs/goal-action-completion.md).

### Verificação da conclusão por ações

- Node.js 24.15.0: build, tipos e lint aprovados; 93 testes unitários/HTTP.
- Suíte completa: 105 testes de integração aprovados em MySQL 8.4.11 e os
  mesmos 105 em MariaDB 10.11.14, em bancos descartáveis.
- Novos cenários: progresso parcial/100, canceladas fora do denominador,
  nova pendência/reabertura, troca/remoção de vínculo, ausência de base, prazo,
  meta cancelada, 151 ações além da paginação, legado sem escrita em GET,
  isolamento e rollback de ação/meta/auditorias em falha de sincronização.
  Avaliações/snapshots e lastResult permanecem independentes.
- OpenAPI mantém 179 operações; nenhum contrato de requisição alterado.
  91 exemplos JSON válidos, oito respostas de metas/painel conferidas contra
  schemas e links locais verificados. Sem migration, alteração no banco da
  aplicação, commit ou publicação.
