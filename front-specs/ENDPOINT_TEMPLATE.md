# Modelo de documentação de endpoints

Copiar as seções abaixo para o guia da funcionalidade e preencher com o
contrato efetivamente entregue. Repetir a seção de endpoint para cada rota.
Este arquivo é um modelo; não descreve um endpoint disponível.

## Funcionalidade: [nome]

- **Disponibilidade:** [implementado / descontinuado / removido].
- **Versão da API:** [versão].
- **Última atualização:** [data da entrega].
- **Referência OpenAPI:** [operationId e localização da documentação].
- **Resumo:** [o que a funcionalidade permite e em qual fluxo é utilizada].

## [MÉTODO HTTP] [caminho completo]

### Objetivo e acesso

Descrever a ação, pré-condições, autenticação, permissões e escopo de
Workspace/Project. Informar de onde o front obtém os IDs necessários.

### Requisição

| Local | Campo | Tipo/formato | Obrigatório | Padrão, limites e regras |
| --- | --- | --- | --- | --- |
| [rota/query/header/body] | [campo] | [tipo] | [sim/não] | [regras] |

Detalhar enums, campos ausentes/nulos, validação de UUID/datas e limites.
Para listagens, informar paginação, filtros permitidos e ordenação.
Para uploads/downloads, informar Content-Type e formato específico.

Inserir um exemplo completo de requisição HTTP ou de consumo, sem segredos
reais. Usar blocos `json` apenas para JSON válido, com os campos reais do
contrato; placeholders sensíveis ficam dentro de strings.

### Respostas de sucesso

- **Status HTTP:** [status por cenário].
- **Headers relevantes:** [Location, X-Request-Id, cache, tipo de conteúdo etc.].
- **Campos retornados:** [tipos, formatos, enums, opcionalidade e significado].

Inserir exemplos completos do envelope de sucesso e, quando aplicável,
paginação, listagem vazia ou retorno de arquivo. Para 204, indicar que não
existe corpo. Explicar alterações de estado produzidas pela operação.

### Erros e tratamento no front-end

| HTTP | code | Quando ocorre | Tratamento esperado no front |
| --- | --- | --- | --- |
| [status] | [código real] | [condição] | [ação/mensagem/campo] |

Inserir exemplos de Problem Details para os cenários relevantes. Explicar
como associar `errors` aos campos do formulário e preservar `requestId`.
Informar a política de retry e se a operação é idempotente. Distinguir
falha de rede/timeout de uma resposta HTTP e esclarecer quando confirmar
o estado no servidor antes de repetir uma mutação.

### Fluxo de integração

1. [Preparar dados, validar pré-condições e iniciar loading].
2. [Enviar requisição, tratar submissão duplicada/concorrência se aplicável].
3. [Aplicar sucesso, atualizar/invalidate caches do escopo correto e navegar].
4. [Tratar validação, permissão, sessão e falhas, encerrando loading].

Descrever regras que afetam a interface, como snapshots, arquivamento,
estados permitidos, atualização de listas e isolamento por Workspace.
Evitar prescrever detalhes visuais que não façam parte desta entrega.

### Alterações e compatibilidade

- **Tipo da entrega:** [criação / alteração / descontinuação / remoção].
- **Mudança:** [contrato anterior e atual; na criação, indicar primeira versão].
- **Impacto no consumidor:** [campos, fluxos ou chamadas a adaptar].
- **Migração:** [ações e prazo, se houver; ou não se aplica].
- **Limitações conhecidas:** [limitações reais; ou nenhuma identificada].
- **Verificação:** [cenários/testes executados e suas limitações].
