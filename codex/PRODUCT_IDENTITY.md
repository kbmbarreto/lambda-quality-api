# Identidade do produto — Lambda Quality

Decisão de 04/11/2026: adotar **Lambda Quality**, em alusão à **Lambda Team**,
como nome do produto e manter o código aberto sob a licença MIT.
O usuário confirmou uma **instalação nova, sem migração de dados existentes**.

## Nomes e distribuição

| Contexto | Identificador |
| --- | --- |
| Produto / Swagger | Lambda Quality / Lambda Quality API |
| Pacote npm e imagem da API | `lambdaquality-api` |
| Imagem de migrations | `lambdaquality-migrations` |
| Variáveis da aplicação e deploy | `LAMBDAQUALITY_*` |
| Transporte de variáveis da Library no CI | `LQ_ENV_*` |
| JWT padrão: emissor / audiência / chave local | `lambdaquality-api` / `lambdaquality-client` / `lambdaquality-local` |
| Problem Details | `urn:lambdaquality:problem:<tipo>` |
| Propriedades JUnit | `lambdaquality.caseId` / `lambdaquality.humanId` |
| Banco e usuário de exemplo | `lambdaquality` |
| Schemas descartáveis de integração | `lambdaquality_test_<12 caracteres hexadecimais>` |

O documento conceitual passa a se chamar `Lambda_Quality_Ideias_Iniciais.md`.
Os exemplos de organização e sistemas usam Lambda Team e nomes fictícios.

A [licença MIT existente](../LICENSE) mantém seu aviso de copyright original.
`package.json` e o pacote raiz do lockfile declaram `license: MIT`; as imagens
Docker incluem `LICENSE` e o metadado de licença. `private: true` impede
publicação acidental no registro npm e não restringe a licença do código.

## Compatibilidade e instalação

Configurar um novo banco e credenciais, chaves JWT/cofre, remetente SendGrid,
bucket/prefixo OCI e recursos Azure DevOps a partir dos exemplos atualizados.
Nomes sugeridos de Environment, Library, imagens e diretórios precisam ser
provisionados no ambiente de destino; a alteração local não cria esses recursos.
O pool de agentes é selecionado pelo parâmetro `ciPoolName` das pipelines.

Não executar esta versão diretamente sobre uma instalação anterior:

- A configuração reconhece os novos nomes `LAMBDAQUALITY_*`.
- Os novos padrões de issuer/audience/kid JWT exigem tokens compatíveis.
- Os códigos de e-mail usam o novo domínio HMAC `lambdaquality-email-code-v1`.
  Desafios emitidos com o domínio anterior não são aceitos.
- O cofre usa AAD `lambdaquality-test-vault`, versão `2`, e payload `v2`.
  Ciphertexts do formato anterior não são aceitos, mesmo com a mesma chave.
- Objetos OCI existentes não são copiados nem renomeados automaticamente.
- Importações JUnit devem enviar os novos nomes de propriedades.
- O campo `type` de todos os erros muda de namespace; consumidores devem usar
  `code` para decidir tratamento. Códigos, status HTTP e caminhos são preservados.

As migrations SQL versionadas permanecem intactas; a instalação nova aplica
o histórico correspondente ao seu `DATABASE_DIALECT`. Nenhum banco, segredo,
arquivo OCI ou recurso remoto foi alterado nesta entrega. Uma futura migração
de instalações anteriores exige planejamento e implementação próprios.

## Verificação da entrega

Com Node.js 24.15.0: lint, tipos e build aprovados; 113 testes unitários/HTTP
e 14 testes de CI/CD com Docker simulado aprovados. OpenAPI regenerado;
quatro arquivos YAML, referências locais e 417 exemplos JSON verificados.
Busca nos arquivos versionáveis não encontrou nomes ou caminhos da identidade
anterior. Integração com MySQL real foi tentada, mas os 130 testes não puderam
executar porque o daemon Docker estava desligado. Imagens Docker não foram
construídas nesta verificação.
