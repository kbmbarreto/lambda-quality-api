# Melhorias do produto — integração do front-end

Disponível na API v1 em 06/10/2026. Este guia descreve o trabalho solicitado para
as telas; os contratos por endpoint estão nos guias vinculados abaixo.

## Tela de Defeitos

Atualização de 08/10/2026: [resumo global](defect-summary.md) com os mesmos filtros,
sem paginação; resolvedAt aditivo. Workspace explícito sem grant defect.read
retorna 404. Global sem fontes autorizadas continua vazio.

Mostrar uma tabela abaixo da área/modal de seleção de Workspace, na tela inicial
Defeitos. Carregá-la mesmo antes de selecionar Workspace com `GET /api/v1/defects`.
A resposta reúne todos os defeitos atualmente autorizados, incluindo projetos
arquivados; paginação, busca e filtros são feitos no servidor.

Colunas: ID humano, título, Workspace, projeto, situação, severidade, ambiente,
criado em e atualizado em. Usar workspaceId/projectId/id da linha para abrir o
defeito com as rotas existentes; o ID humano pode repetir entre Workspaces.
Ao selecionar Workspace, enviar workspaceId para restringir a tabela. Não varrer
os projetos nem exigir seleção prévia para carregar o inventário. Uma lista vazia
é válida; esconder fontes sem acesso é responsabilidade da API. Cancelar requests
obsoletos ao trocar contexto e invalidar a tabela após criar/alterar defeitos.

[Contrato do inventário](defect-inventory.md).

## Repositório de testes: importar do Azure DevOps

Adicionar botão **Importar CSV do Azure DevOps** no projeto aberto, visível com
`testcase.create`. O seletor aceita somente `.csv`; validar extensão e 5 MiB antes
do envio. Enviar multipart `file`, deixando o navegador definir o boundary.

Os casos entram no projeto aberto, com suiteId null e situação DRAFT. Não enviar
suiteId, projectId ou opções adicionais no multipart. Após sucesso, mostrar
importedCount, indicar quando alreadyImported é true e atualizar a listagem raiz
(`root=true`), as contagens e a visão geral. O filtro ACTIVE não mostrará novos
rascunhos: oferecer visualização dos importados com DRAFT/ALL.

Preservar o arquivo ao corrigir erro, encerrar loading e impedir submissão duplicada.
O mesmo arquivo no mesmo projeto é idempotente, inclusive após timeout; arquivos
com conteúdo diferente representam novas importações. Mostrar erros por registro
lógico (não linha física: células podem conter quebras de linha). O BDD fica na
descrição, com passos preservados; renderizar texto escapado mantendo as quebras.
Este fluxo importa casos, não cria planos, suítes ou conexão autenticada ao Azure.

[Contrato CSV](azure-test-case-import.md).

## Cofre por projeto

Criar uma área **Cofre de testes** no projeto. Separar as ações pelas capabilities
retornadas no projeto: testvault.read para a lista de metadados; testvault.manage
para criar/editar/excluir; testvault.reveal para revelar/copiar dados sensíveis.
As permissões são efetivas, combinando grants de Workspace e participação no projeto.
Uma permissão de consulta não autoriza revelar senhas. Member não ganha grants
novos automaticamente; Owner/Administrator têm o catálogo completo.

Formulário: nome/identificação (metadado público dentro do escopo autorizado),
ambiente opcional ativo não produtivo, usuário, senha, URL e notas. Usuário, senha,
URL e notas são cifrados no banco. Usar environmentId dos ambientes do projeto;
excluir PRODUCTION e inativos das opções. Campos secretos aceitam vazio, permitindo
massas/notas sem senha. Tratar name como rótulo, sem inserir credenciais nele.

A lista não recebe nenhum segredo e não deve preencher senhas fictícias como `***`
no payload de atualização. Para editar os dados sensíveis, revelar explicitamente
quando autorizado e enviar o objeto secret completo; omiti-lo preserva tudo.

Revelação usa POST com `{}`. Não guardar o conteúdo em localStorage, sessionStorage,
URL, telemetry/logs ou caches persistentes; manter em memória somente enquanto
necessário e limpar ao ocultar/fechar/trocar projeto ou sair. Respeitar no-store.
Não disparar reveal automaticamente para montar a tabela. Usar version para edição
/exclusão; em 409 recarregar metadados e pedir que o usuário reconcilie. Em 503,
mostrar detail, preservar o formulário em memória e manter o restante do sistema.

[Contrato do cofre](test-vault.md).

## Datas e controles

Todas as respostas HTTP apresentam timestamps com offset **-03:00**. Usar parser
ISO e formatar em `America/Sao_Paulo`, sem subtrair três horas manualmente. Datas
YYYY-MM-DD são datas de calendário: mantê-las sem conversão de fuso. O banco e JWT
continuam UTC; não há reescrita de históricos. Para instantes, comparar valores
parseados, não igualdade de strings Z/-03:00. Não ordenar datas por texto formatado.
As regras de período/agregação dos endpoints existentes permanecem as documentadas.

Exemplo: `2026-10-06T01:00:00.000Z` corresponde a
`2026-10-05T22:00:00.000-03:00`. O dia pode mudar, mas o instante é o mesmo.

Na lista de controles do framework, remover a ordenação automática por code.
Consumir a ordem padrão da API ou enviar `sort=creationOrder,asc`. creationOrder é
numérico, imutável e definido pelo banco; code continua sendo o código informado
pelo usuário. Não ordenar UUIDs para inferir criação. Controles antigos recebem
ordem determinística na migration, pois não havia registro individual de criação.
Atualizações de code não mudam creationOrder. Avaliações históricas são preservadas.

## Implantação e compatibilidade

Aplicar migration `202610060001_product_improvements` no histórico do dialeto antes
de iniciar a API atualizada; sem reset/db push. Cofre exige chave externa nova,
conforme [operação](../codex/PRODUCT_IMPROVEMENTS_20261006.md). As rotas existentes
continuam funcionando; datas passam de Z para -03:00 preservando os instantes.
A importação não usa OCI nem a biblioteca de anexos. Recarregar as permissões do
projeto após administrar grants. OpenAPI atualizado em openapi.json e /docs-json.
