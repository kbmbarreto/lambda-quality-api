# Decisões da Fase 02 — Projetos

Escopo autorizado: Project, ProjectMember, Milestone e Environment, com
Swagger, auditoria, testes MySQL e guias front-end. Não antecipar casos de teste.

Evolução na Fase 03: [Casos de Teste](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md)
acrescenta testcase.read/create/update/archive à matriz local, mantendo a
interseção e prevenção de escalada. Consulte a matriz atual em front-specs.

- Key normalizada uppercase, 2–12 caracteres `[A-Z][A-Z0-9_]*`, única por
  Workspace e imutável. Nome até 100; descrição opcional/nula até 500.
- Project ACTIVE/ARCHIVED; criação vincula o criador como MANAGER. Archive
  idempotente preserva tudo e bloqueia mutações de filhos; leituras continuam
  autorizadas. Não há exclusão física de Project nem restauração nesta fase.
- Novas permissions: project.read/create/update/archive/manage_members/manage_all,
  milestone.manage e environment.manage. Owner e Administrator recebem todas;
  Member recebe project.read. Migration atualiza roles de sistema existentes.
  Roles customizadas mantêm suas concessões, sem ampliação automática.
- ProjectMember referencia WorkspaceMember por FK composta; roles locais
  VIEWER (leitura), EDITOR (leitura/edição/marcos/ambientes), MANAGER (também
  arquivar/gerir participantes). Autorização exige permission atual do Workspace
  E capability da role local. project.manage_all dispensa apenas o vínculo
  local, não as demais permissions. Owner possui todo o catálogo.
  Exemplo: atribuir MANAGER a um Member não lhe concede project.update;
  administrador precisa conceder também essa permission via role de Workspace.
- Leitura sem vínculo e sem manage_all retorna 404; ação sem permission em
  projeto visível retorna 403. Listagens/contagens/buscas filtram projetos
  visíveis antes de paginar. Nenhum acesso baseado apenas em UUID ou JWT roles.
- PUT de participante cria/altera vínculo por workspaceMemberId, idempotente;
  DELETE remove a concessão. Atribuir role local exige que o ator possua todas
  as capabilities dessa role no projeto (sem escalada). Só membros ACTIVE com
  User ACTIVE entram. Remoção do Workspace limpa vínculos de projeto na mesma
  transação, impedindo recuperar grants antigos ao aceitar novo convite.
- Todas as operações usam a unidade transacional pública existente e lock
  do Workspace; ports incluem os quatro repositories de Project. Domínio e
  aplicação permanecem independentes de NestJS/Prisma. FKs compostas preservam
  escopo Workspace/Project, inclusive `(workspace_id,project_id,id)` nos filhos.
- Milestone: nome/descrição, datas de calendário opcionais YYYY-MM-DD, início
  não posterior ao prazo; PLANNED/IN_PROGRESS/COMPLETED/CANCELLED. Complete
  idempotente fixa completedAt; concluído não é reaberto/reescrito. Exclusão
  lógica preserva registro; listas padrão omitem excluídos.
- Environment: nome único normalizado por projeto (trim/NFKC/lowercase),
  descrição opcional, active boolean. DELETE lógico desativa e preserva;
  nome continua reservado. DELETEs de filhos são idempotentes.
- Catálogos de campos/tags e biblioteca de anexos continuam tenant-wide.
  Não criar associações artificiais com Project; vínculos vêm com consumidores.
- Auditoria transacional usa Workspace e entityId/correlationId existentes;
  sem novo endpoint de auditoria nem metadados privados no DTO.
