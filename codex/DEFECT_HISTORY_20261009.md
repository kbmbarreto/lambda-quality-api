# Comentários e histórico de defeitos — 09/10/2026

Escopo autorizado: comment no PATCH existente e histórico unificado persistente;
um novo GET por defeito. Não alterar overview nem acrescentar otimização opcional
metrics.openDefects. Estoque OPEN já funciona pelo inventário sem janela de criação.

DefectHistoryEvent é append-only pelo port (create/list/count, sem update/remove)
e pela API, que não tem edição/exclusão. FK composta de Workspace/projeto/defeito
preserva isolamento e impede apagar o recurso com histórico. Actor é ID global
derivado da sessão, sem FK para membership e sem depender de nome atual para ler.
Snapshot de displayName no novo evento; nunca fallback para email. Actor ID legado
pode ser null. Referência escalar preserva também IDs de autores ausentes da base
de identidade, como na auditoria histórica; não substitui autor por outro usuário.

Migration aditiva 202610090001_defect_history nos dois dialetos. Copia todos os
eventos defect.* associados a Defect do mesmo Workspace: ID, actorUserId e occurredAt
originais. CREATED para created/created_from_failure, UPDATED para outros eventos.
AuditEvent legado não contém payload; fromStatus/toStatus/comment/displayName são
null, sem reconstrução a partir de updatedAt/estado atual. Recurso sem auditoria
não recebe criação sintética. A recuperação é limitada ao histórico disponível;
limitação comunicada e registrada no contrato para o front antes da integração.

Criação por ambos os fluxos registra CREATED (null→OPEN) na transação. Alterações
registram UPDATED junto com version/updatedAt e auditoria. PATCH com status+comment
produz um evento; comment isolado também incrementa versão. Mesmo status sem
comment, sendo o único campo, preserva no-op. Atualizações de metadados/anexos/
referências também deixam eventos genéricos, sem detalhar campos. Todas as alterações
de situação da API usam esse caminho, inclusive edição completa e reabertura.

Comment trim 1–10000, texto literal com quebras internas, não aceita null. JSON
permanece limitado a 32 KiB; não expor conteúdo nos logs nem gravá-lo na descrição.
Sem idempotency-key nesta entrega. Versão impede reaplicação de uma versão antiga;
reenvio com versão nova exige revisão do cliente para evitar comentário duplicado.
Falhas de evento/auditoria fazem rollback de metadados, status, resolução, versão
ou criação; requisições concorrentes com mesma versão têm somente um sucesso.

GET usa mesmo Workspace/projeto/defeito e defect.read do detalhe, sem grant de
auditoria global. page=1/size=20, até 100; sort apenas createdAt asc/desc, ID asc como
desempate. Projeto arquivado é legível; escrita bloqueada. Campos sem conhecimento
histórico null; timestamp HTTP -03:00, persistência UTC. Todo o histórico é paginado,
sem limite temporal ou limite de 100 registros no total.

[Contrato e integração](../front-specs/defect-history.md); OpenAPI 187 operações.
Aplicar migration:deploy antes da nova API. Banco real, OCI e e-mail real não
alterados pelos testes; não criar commits ou publicar nesta entrega.

Validação concluída: build, typecheck e lint aprovados; 112 testes unitários/HTTP
e 130 testes de integração em cada dialeto (MySQL 8.4 e MariaDB 10.11)
em containers descartáveis. Exemplos JSON, links locais e 187 operationIds
únicos conferidos. O Docker precisou ser iniciado antes dos testes de integração.
