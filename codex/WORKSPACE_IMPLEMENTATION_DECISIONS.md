# Decisões de implementação — Workspaces

Registradas em 02/10/2026, antes das migrations da Fase 01, dentro do escopo
solicitado. Este arquivo consolida as propostas do plano adotadas na
implementação; [front-specs](../front-specs/README.md) e OpenAPI descrevem
os contratos efetivamente entregues (48 endpoints novos).

Evolução na Fase 02: [decisões de Projetos](PROJECT_IMPLEMENTATION_DECISIONS.md)
ampliam o catálogo para 20 permissions (Member recebe project.read) e limpam
ProjectMember na remoção do Workspace. As demais decisões desta fase são preservadas.

Evolução na Fase 03: [Casos de Teste](TEST_MANAGEMENT_IMPLEMENTATION_DECISIONS.md)
amplia catálogo para 24 permissions; Member recebe testcase.read. Valores e
vínculos agora têm consumidores. Demais catálogos continuam tenant-wide.

- Workspace ACTIVE, slug normalizado global único, nome até 100 caracteres.
  Um Owner via ownerMemberId, FK composta para membro do mesmo tenant.
  Campo nulo somente durante bootstrap transacional; nenhuma criação da API
  termina sem Owner. Transferência bloqueia Workspace e exige destino ativo.
- Administrator e Member são roles de sistema imutáveis. Owner é vínculo
  separado, com todas as permissions do catálogo atual; não pode ser concedido
  por grupo. Administrator recebe gestão administrativa exceto ownership.
  Member recebe leitura de Workspace, membros, roles/grupos, campos, tags e
  anexos. Roles customizadas usam o catálogo desta fase, sem permissions
  fictícias de módulos ainda indisponíveis.
- Toda operação no tenant resolve estado atual e autoriza dentro da transação
  que acessa/muda recursos. Escritas de acesso serializam pelo Workspace,
  impedindo validações concorrentes com permissões já revogadas. Roles
  atribuídas/alteradas não podem exceder permissions efetivas do ator;
  grupos e suas mudanças seguem a mesma regra, inclusive inclusão de membros.
- Vínculo único por Workspace/User, estados ACTIVE/SUSPENDED/REMOVED.
  Remoção é lógica e limpa roles/grupos. Reentrada por novo convite usa o
  vínculo existente e somente Member. Convite não contorna suspensão.
- Convite dura 48 horas, reenvio após 60 segundos, ambos configuráveis.
  Status PENDING/ACCEPTED/CANCELED; EXPIRED é derivado de expiresAt.
  Aceite autenticado exige e-mail verificado correspondente. Retry retorna
  o vínculo já aceito somente enquanto ativo; token anterior não funciona
  após reenvio. Reenvio também permite recuperar entrega de e-mail falha.
- Convite e intenção de envio persistem atomicamente. Payload de envio contém
  token cifrado AES-256-GCM com chave derivada de segredo configurado;
  expiração e limite de tentativas são definidos. Nenhum token vai para logs,
  auditoria ou DTO de listagem. Após envio/cancelamento/aceite remove-se payload
  cifrado; falha deixa envio recuperável. O remetente reutiliza SendGrid.
  Link opcional do front usa fragmento; API recebe token somente no body.
  Worker executa a cada 30 segundos, com backoff exponencial e até cinco
  tentativas por envio; reenvio manual reinicia a contagem e troca o token.
  SENT indica aceite pelo provedor. O envio é pelo menos uma vez: falha de
  commit após aceite do provedor pode causar e-mail repetido com o mesmo token.
  Segredo de cifragem deve permanecer estável entre instâncias/reinícios.
- Catálogo de campos pertence a testmanagement: TEXT/NUMBER/BOOLEAN/DATE/
  SINGLE_SELECT, alvo TEST_CASE, chave única normalizada por Workspace/alvo.
  Opções têm UUIDs e labels; tipo/chave/alvo/opções ficam imutáveis após criação.
  Pode alterar nome/descrição/obrigatoriedade/posição e arquivar. Valores de
  TestCase e snapshots entram com os consumidores, sem antecipar suas tabelas.
- Tags do Workspace pertencem a testmanagement, nome normalizado único por
  Workspace. Sem Project/TestCaseTag nesta fase; vínculos vêm posteriormente.
- Anexos pertencem ao módulo attachment: originalmente storage local privado,
  key aleatória, escrita exclusiva, checksum SHA-256 e MIME conferido pelo
  conteúdo. Limite padrão 10 MiB; PNG/JPEG/PDF/TXT/CSV. SVG/HTML/executáveis
  não são aceitos. Download usa attachment e nosniff; nenhum diretório estático.
  Exclusão lógica auditada; remoção física com prazo padrão de 30 dias via
  rotina explícita, que também limpa uploads órfãos antigos. Falhas de storage
  retornam erro legível e compensação evita metadados que apontem a upload falho.
  Em 04/10/2026, o adapter padrão foi substituído por Oracle OCI Object Storage,
  sem fallback local. O adapter local é usado somente na migração explícita de
  arquivos antigos. A limpeza `npm run attachments:cleanup` usa OCI, com órfãos
  de mais de 24 horas. Ver [decisões OCI](OCI_STORAGE_IMPLEMENTATION_DECISIONS.md).
- Catálogos, listagens e contagens filtram tenant; paginação page/size e sort
  permitidos explícitos. Recursos são buscados por workspaceId + id.
  AuditEvent mantém Workspace, ator e requestId, sem payloads sensíveis.
- Domínio/application não importam NestJS ou Prisma. Identity expõe directory
  público com DTO restrito; outros módulos não acessam seu repository interno.
  Repositories/adapters preservam constraints e isolamento no MySQL real.

Shared parameters/Shared steps continuam excluídos. Projetos e demais fases
não integram esta implementação. Testes usam mock de e-mail, sem envio real.
Regular/Guest, jobTitle e coluna de última ação não foram contratados nesta
fase; eventos de auditoria são persistidos, sem endpoint geral de consulta.
