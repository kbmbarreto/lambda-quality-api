# Evoluções do produto — 06/10/2026

Escopo solicitado: inventário de defeitos, importação CSV Azure DevOps, cofre
criptografado para dados de teste, apresentação de datas UTC-3 e ordem dos controles.
Esta entrega é local; não autoriza importar dados no banco real ou publicar.

## Decisões de implementação

- Inventário: leitura paginada de todos os defeitos atualmente autorizados, com
  contexto de Workspace/projeto. Inclui projetos arquivados; Workspace exige
  membership ativo e defect.read efetivo por projeto. Nenhuma leitura de anexos.
- CSV: upload multipart UTF-8 .csv, 5 MiB, até 200 casos e 10000 linhas lógicas.
  Formato Azure com cabeçalhos ID, Work Item Type, Title, Test Step, Step Action,
  Step Expected. Aspas, vírgulas e quebras de linha internas são suportadas.
  Casos DRAFT no projeto da rota, sem suíte; passos preservados e BDD na descrição.
  Importação atômica e recibo por SHA-256/projeto evitam duplicar o mesmo arquivo.
  Nenhuma conexão remota, plano/suíte automático ou identidade Azure importada.
- Cofre: chave AES-256-GCM independente, externa ao banco, IV aleatório por escrita,
  AAD com Workspace/projeto/entrada. Usuário, senha, URL e notas criptografados.
  Listagem somente metadados; revelação explícita e auditada, com grant separado.
  Chave ausente não interrompe a API; gravação/revelação do cofre respondem 503.
- Datas: persistência, aritmética e JWT permanecem UTC. Transporte HTTP apresenta
  timestamps ISO 8601 com -03:00, preservando o mesmo instante; DATE permanece
  YYYY-MM-DD. Sem subtrair três horas do banco, sem alterar snapshots armazenados.
- Controles: creationOrder numérico técnico, gerado pelo banco, imutável; ordenação
  padrão crescente. code permanece identificador editável do usuário. Dados legados
  não possuem timestamp/ordem individual recuperável: migration atribui sequência
  determinística, e a partir dela novos controles seguem a ordem real de inserção.

Referências criptográficas: [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
e [Node Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html).

## Cofre: escopo, operação e chaves

Cofre por projeto e inventário de todos os Workspaces autorizados foram confirmados
pelo usuário. Novas permissões testvault.read/manage/reveal são concedidas a roles
Administrator existentes na migration; Owner usa todo o catálogo. Member/roles
customizadas preservam seus grants. Papéis locais limitam as capabilities e a
atribuição de participantes não pode ampliar acesso efetivo ao cofre acima do
ator. Não exige grants do cofre para atribuir VIEWER a quem não os possui.

Configuração externa, opcional no bootstrap:

- TEST_VAULT_ACTIVE_KEY_ID=v1
- TEST_VAULT_ENCRYPTION_KEYS: JSON de IDs para chaves base64 de 32 bytes.

Gerar o valor JSON localmente para inserir na variável **secret** da Library
LambdaQuality-HML ou no .env privado, sem versionar:

```bash
node -e 'console.log(JSON.stringify({v1:require("node:crypto").randomBytes(32).toString("base64")}))'
```

No .env, usar aspas simples externas ao valor JSON; na Library, inserir o JSON
sem aspas externas. A pipeline mapeia ambos os nomes explicitamente e mantém
configuração privada por release. Não reutilizar JWT, OTP ou chave OCI.
Preservar a chave e seu backup fora do banco: perdê-la impede recuperar os dados.
Para rotacionar, adicionar nova chave no JSON, manter as antigas e alterar activeKeyId;
reiniciar/publicar configuração. Escritas novas e substituições secret usam a nova
chave; cada entrada antiga mantém keyId. Não remover chaves antigas enquanto houver
entradas/backups que dependam delas. Não há recifragem em massa nesta entrega.

VaultEntry usa FKs compostas para projeto/ambiente, exclusão lógica e version;
AAD associa ciphertext ao ID técnico e escopo. Listagem não decifra nem envia
segredos; POST reveal decifra somente depois de autorizar e audita antes de retornar.
Sem chave, criação/substituição sensível/revelação retornam 503; consulta, edição de
metadados e exclusão continuam disponíveis. Nome é metadado e não deve conter segredo.

## Migrations e contratos

Aplicar 202610060001_product_improvements com migration:deploy no histórico do
DATABASE_DIALECT. UUIDs mantêm ascii/ascii_bin para compatibilidade das FKs;
cria test_case_imports e test_vault_entries, permissions e creationOrder.
Não foi aplicado ao banco real nesta entrega. A alteração de datas é de transporte,
sem SQL de reescrita, sem trocar timezone do banco ou reinterpretar DATE.

Guias: [tarefas do front](../front-specs/product-improvements.md),
[inventário](../front-specs/defect-inventory.md), [CSV](../front-specs/azure-test-case-import.md)
e [cofre](../front-specs/test-vault.md).

## Verificação concluída

Node.js 24.15.0: build, typecheck e lint aprovados; 92 testes unitários/HTTP,
98 integrações MySQL 8.4.11 e 98 integrações MariaDB 10.11.14 aprovados. Bancos
reais descartáveis, migrations em banco vazio e upgrade das fases anteriores.
Importação do CSV fornecido anonimizado cria cinco casos/18 passos, retries não
duplicam e nenhum caso fica em suíte. Cofre verifica ciphertext, AAD, IV aleatório,
rotação mantendo chave antiga, revelação auditada, grants, restrição de ambiente,
version/deleção e falha de chave sem impedir API. Permissões de participantes
mantêm o fluxo anterior e bloqueiam concessão efetiva nova acima do ator.

14 testes de publicação passaram, incluindo persistência literal do JSON de
chaves no env-file privado da Library. YAML e mapeamento do deploy conferidos.
OpenAPI: 179 operações; exemplos JSON e referências dos novos guias validados.
A primeira execução detectou collation incompatível das FKs; corrigida antes da
entrega. Regressões de grants/contagens antigas foram corrigidas e as suítes finais
passaram. Não houve importação no banco real, geração de chave real, deploy ou
commit. O front ainda precisa implementar as telas descritas no guia.

## Correção do cofre e quota autenticada — 08/10/2026

Diagnóstico local sem exibir valores: variável preenchida, JSON e ID existentes,
mas chave fora do Base64 canônico AES-256 de 32 bytes. O 503 era a proteção
criptográfica esperada; não truncar/hashear senhas arbitrárias como substituto.
Adicionado setup:vault-key explícito para .env privado: novo ID, preservação de
material antigo, escrita atômica 0600 e execução idempotente se chave válida.
vault:check compartilha o validador com o cipher, sem banco/OCI ou valores em
saída. Startup registra somente evento/motivo seguro e continua com cofre
indisponível em configurações inválidas; HTTP permanece 503 sanitizado.
O .env local foi corrigido e a chave validada com round-trip sintético, sem
escrever no banco. Nenhuma recifragem de entradas anteriores.

Por solicitação do usuário, removida a quota compartilhada de 120 chamadas/
minuto dos módulos autenticados. WorkspaceRequestGuard mantém validação/no-store,
sem map/contador. WORKSPACE_RATE_LIMIT deixa de ser lido; variável antiga pode
permanecer na Library sem efeito. Não aumentar artificialmente o limite.
Autenticação pública mantém RateLimitGuard por método; me/logout/logout-all
usam bearer e guard de query, sem quota. Reenvio de convites mantém cooldown
persistido. Permissões, revogação, payload/paginação/snapshots permanecem.
OpenAPI e guias por endpoint removem o 429 geral; nenhum endpoint novo/migration.

### Verificação da correção de 08/10/2026

- Build, typecheck e lint aprovados em Node.js 24.15.0; 98 testes unitários/HTTP.
- 108 testes de integração aprovados em MySQL 8.4 e os mesmos 108 em MariaDB
  10.11, em bancos descartáveis. Inclui 130 inclusões sequenciais no plano,
  consultas de outros módulos sem quota, UUID/query, outro tenant, cofre
  criptografado/ausente, ambiente não produtivo, versão, exclusão e auditoria.
- Quota pública ainda retorna 429/Retry-After; me/logout-all funcionam mesmo
  após esgotá-la. Diagnóstico/configuração inválidos não expõem chaves.
  Setup local preserva IDs antigos, configura novo ID em arquivo privado e
  é idempotente; aspas no material antigo e JSON inválido são cobertos.
- OpenAPI mantém 179 operações e schemas/respostas/security anteriores,
  exceto retirada do 429 geral de 170 operações. Sete operações conservam
  proteções específicas. 402 exemplos JSON e 768 links locais conferidos.
- 14 testes dos helpers de deploy/rollback aprovados; helpers do cofre
  incluídos no Docker runtime, sem .env/chaves no contexto da imagem.
  Não foi feita build/publicação de imagem ou deploy real nesta entrega.
- .env local validado com round-trip sintético e vault:check; não foi
  consultado/alterado o banco da aplicação, nem enviada mensagem por e-mail.
  Sem migration, commit ou publicação. Reiniciar API para carregar configuração.
