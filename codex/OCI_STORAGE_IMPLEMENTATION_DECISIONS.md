# Anexos e evidências no Oracle OCI Object Storage

Entrega de 04/10/2026. Substitui o armazenamento local utilizado na Fase 01.
Atualização de 05/10/2026: startup independente do OCI, conforme solicitação.

## Estratégia e contrato

- Adapter `OciStorage` implementa `FileStorage` usando os SDKs oficiais Oracle
  `oci-objectstorage`/`oci-common` 2.142.1. Domínio e aplicação permanecem
  independentes de NestJS, Prisma e SDK OCI.
- Upload multipart continua na API: Multer em memória, validação de tamanho,
  MIME/conteúdo e nome, envio de bytes à OCI. Não cria arquivos temporários no
  disco e não grava base64/binário no banco. Upload direto do navegador à OCI
  não faz parte desta entrega.
- OCI armazena `<prefix>/<UUID-v4>.blob`; metadados no banco continuam com a
  chave UUID existente. Nenhuma migration ou alteração de IDs é necessária.
  `If-None-Match: *` evita sobrescrever objetos existentes. OCI confere MD5 e
  SHA-256 do upload; checksum SHA-256 permanece nos metadados da API.
- Download privado usa stream Node/web da OCI após autorização atual por
  Workspace, sem URL pública, PAR ou redirecionamento. MIME/nome/tamanho vêm
  dos metadados autorizados. Mantém `no-store`, `nosniff` e `attachment`.
- Erros de upload/abertura continuam `503 ATTACHMENT_STORAGE_UNAVAILABLE`,
  sem detalhes do provedor/credenciais. Falha após iniciar bytes encerra o
  stream; não é possível substituir os headers por Problem Details.
- Chamadas de objetos possuem deadline de 15 segundos, também no stream, e nenhuma
  repetição automática do SDK. O limite cabe na transação atual de 20 segundos;
  uma transferência interrompida deve ser tratada pelo cliente. Upload tem
  compensação em falha do banco; resultado incerto na OCI pode deixar órfão,
  removível somente após 24 horas pela rotina existente.
- Não existe fallback local. Configuração ausente/inválida e falhas de chave PEM,
  fingerprint ou acesso OCI **não impedem startup**. `loadConfig` captura somente
  as variáveis de storage e adia a leitura/validação da chave e criação do SDK até
  a primeira operação de arquivo. Nenhuma chamada OCI ocorre no bootstrap.
  Antes de acessar bytes, o adapter exige `NoPublicAccess`; bucket público,
  indisponível ou sem autorização bloqueia a operação, sem alterar sua política.
  Upload responde `503 ATTACHMENT_STORAGE_UNAVAILABLE` com a mensagem
  "Não foi possível anexar o arquivo. O serviço de armazenamento está temporariamente
  indisponível. Tente novamente mais tarde." Download mantém o mesmo código e
  "Não foi possível acessar o arquivo." Login, demais módulos, leituras de
  metadados e exclusão lógica permanecem independentes do OCI.
  `LocalStorage` permanece apenas para a migração explícita, nunca no provider
  padrão da API ou na limpeza operacional.
- O cliente de metadados usa deadline de 3 segundos; a verificação inicial e a
  chamada de objeto cabem no orçamento da transação atual (3s + 15s < 20s).
  Operações simultâneas compartilham a validação inicial. Falhas não ficam gravadas
  como inicialização bem-sucedida e podem ser tentadas novamente; após erro numa
  operação OCI, a próxima operação volta a verificar o bucket. Não há retry de
  uploads automaticamente. Uma falha inicial de leitura do PEM permite nova
  tentativa depois de corrigir o arquivo. Configuração e chave já carregadas com
  sucesso ficam em memória; reiniciar a API após troca de configuração/chave.
- Ferramentas de verificação, migração e limpeza chamam `verifyPrivateBucket`
  explicitamente e continuam interrompendo a tarefa em falha de OCI. Chaves JWT
  RS256, banco e configurações essenciais continuam obrigatórias no bootstrap.

## Configuração

As variáveis abaixo correspondem às fornecidas no `.env`:

| Variável | Uso |
| --- | --- |
| `LAMBDAQUALITY_STORAGE_ORACLE_REGION` | Região do bucket, como `sa-saopaulo-1`. |
| `LAMBDAQUALITY_STORAGE_ORACLE_NAMESPACE` | Namespace Object Storage da tenancy. |
| `LAMBDAQUALITY_STORAGE_ORACLE_BUCKET` | Bucket existente **privado**, `NoPublicAccess`, Standard para download imediato. |
| `LAMBDAQUALITY_STORAGE_PREFIX` | Prefixo exclusivo dos anexos desta instância/banco; não pode ser vazio ou conter traversal. |
| `LAMBDAQUALITY_STORAGE_ORACLE_TENANCY_OCID` | Tenancy do usuário OCI. |
| `LAMBDAQUALITY_STORAGE_ORACLE_USER_OCID` | Usuário que tem a chave pública registrada e autorização IAM. |
| `LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT` | Fingerprint da chave pública registrada na OCI. |
| `LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH` | Arquivo PEM RSA de pelo menos 2048 bits, acessível pelo processo. |
| `LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PASSPHRASE` | Opcional, se a chave estiver cifrada. |

O fingerprint é validado contra a chave lida, antes de construir o cliente.
Erros de leitura/decodificação são tratados sem emitir conteúdo da chave.
O compartment já existente no `.env` não é necessário para operações no bucket
configurado. `LAMBDAQUALITY_LOG_OCI_ENABLED` não controla anexos: esta mudança
não implementa envio de logs à OCI. Campos da autenticação são API signing
keys nativas, não chaves de compatibilidade S3.

Preservar namespace/bucket/prefixo ao reiniciar ou escalar réplicas; trocar esses
valores exige copiar os objetos para o novo destino antes da troca. Bancos de
desenvolvimento/teste/produção devem usar prefixos diferentes, pois a limpeza
considera o inventário do banco correspondente. Não configurar regras OCI que
apaguem/arquivem objetos ativos antes da política de retenção da aplicação.
Versionamento e retenção imutável da OCI têm regras próprias: excluir um objeto
pode preservar versões anteriores ou ser impedido por retenção no bucket.

O usuário OCI precisa de permissões IAM para ler, criar, listar e excluir
objetos no bucket configurado, além de ler os detalhes do bucket para a
verificação de privacidade na primeira operação de arquivo e nos comandos operacionais. Provisionamento de bucket, políticas IAM, URLs públicas e alteração de
políticas existentes não são executados pela aplicação. Saída HTTPS para a
região OCI precisa estar disponível no container.

## Docker e operação

Configure `.env.example` com os valores reais, sem versionar `.env` ou PEM.
Monte a chave como secret/arquivo somente leitura e defina, por exemplo:

```dotenv
LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH=/run/secrets/oci_api_key.pem
```

O usuário do processo precisa conseguir ler o secret. Não copie a chave para
a imagem. A chave de JWT continua independente. Os bytes dos anexos permanecem
na OCI após remover/recriar o container, sem volume de uploads na nova API.

Depois do build, valide o destino antes de liberar uploads:

```sh
npm run build
npm run attachments:check-oci
```

Esse comando consulta o bucket privado, cria um objeto UUID temporário no
prefixo configurado, compara os bytes baixados e remove somente esse objeto.
Não modifica políticas do bucket nem remove objetos existentes. Se uma falha
impedir compensação, o objeto órfão poderá ser removido pela rotina de limpeza.

## Migração dos arquivos existentes

1. Suspender uploads na versão antiga durante a migração. Preservar o banco
   e o diretório antigo em backup. Não apagar os arquivos locais.
2. Configurar OCI e chave, fazer build e executar `attachments:check-oci`.
3. Apontar `ATTACHMENT_STORAGE_PATH` para o diretório antigo (padrão
   `.local/uploads`). Esta variável é exclusiva da ferramenta de migração.
4. Executar simulação e aplicação:

```sh
npm run attachments:migrate-to-oci
npm run attachments:migrate-to-oci -- --apply
```

5. Só liberar a nova versão quando não houver anexos pendentes e a verificação
   de download for bem-sucedida. Não iniciar a limpeza durante a migração.

A ferramenta consulta o banco em páginas de 100, contemplando anexos ativos e
excluídos dentro da retenção configurada. Na simulação, confere origem/destino
sem gravar. Ao aplicar, verifica tamanho/checksum local, cria o objeto sem
sobrescrever e compara o checksum do download OCI. Objetos existentes também
são verificados. Uma segunda execução retoma o trabalho; corrupção, ausência
local ou erro IAM interrompe sem apagar/sobrescrever evidências. Não altera
metadados, IDs, auditorias, associações ou snapshots e não remove arquivos
locais. Excluídos além da retenção não precisam ser copiados; órfãos locais
também não são migrados. O backup local só deve ser descartado após aceite
operacional e conforme a política da equipe.

`npm run attachments:cleanup` mantém a retenção lógica existente (30 dias por
padrão) e limpa órfãos com mais de 24 horas. Agora opera na OCI e percorre todas
as páginas. Só considera objetos diretamente no prefixo configurado com chave
UUID-v4 `.blob` e timestamp válido. Arquivos de outros prefixos, subpastas ou
nomes diferentes não são removidos. Somente `404 ObjectNotFound` é tratado como
exclusão idempotente; erros de bucket/permissão/dependência interrompem a rotina.

## Verificação desta entrega

Testes do adapter incluem SDK oficial com transporte simulado, assinatura,
bytes binários, checksums, criação exclusiva, deadline por chamada, streams
Node/web, cancelamento, paginação, rejeição de bucket público antes de acessar arquivos e
isolamento do prefixo na limpeza. Testes
da migração incluem simulação, retomada, integridade e preservação dos arquivos.
Integração HTTP/banco continua cobrindo isolamento entre Workspaces, grants,
arquivos inválidos, compensação após falha do banco e retenção.

Build, tipos e lint passaram. Foram validados 67 testes unitários (14 específicos
de OCI/migração) e 87 integrações em MySQL 8.4 real.

Validação operacional concluída em 04/10/2026: o caminho do PEM no `.env`
estava sem a barra inicial de `/Users/...`, sendo interpretado como relativo
à pasta da API. Foi corrigido para caminho absoluto, preservando as demais
configurações. A chave foi lida e seu fingerprint conferido.

`attachments:check-oci` confirmou bucket privado, upload, download e remoção
na OCI real. A simulação da migração encontrou um anexo ativo pendente; a
execução com `--apply` copiou esse anexo e verificou seus bytes/checksum, com
zero pendências. Arquivo local, metadados e vínculos foram preservados.

A API iniciou na porta 3000 e `/api/v1/health/ready` retornou HTTP 200. A
instância utilizada para essa verificação foi encerrada ao final para liberar
a porta. O teste real OCI foi realizado pelo adapter/SDK; os testes HTTP de
autorização e isolamento usam o armazenamento simulado e MySQL real.

### Atualização de 05/10/2026 — indisponibilidade isolada dos anexos

Build, tipos e lint aprovados. Passaram 74 testes unitários, 90 integrações com
MySQL 8.4.11 e 90 com MariaDB 10.11.14 reais e descartáveis, além de 14 testes
do fluxo de publicação. Casos adicionais cobrem configuração/PEM ausentes,
PEM inválido, fingerprint incompatível, acesso negado, bucket público, recuperação,
operações concorrentes, isolamento e ausência de metadados após upload com falha.
HTTP de autenticação, readiness e consultas de anexos permanecem disponíveis.

A imagem runtime foi construída e iniciou com MySQL descartável, chaves JWT
fictícias e sem configuração/PEM OCI; readiness retornou 200 e login inválido 401.
Os recursos desse teste foram removidos. Não houve acesso ao OCI real, alteração
do `.env` real ou deploy no servidor nesta atualização. OpenAPI e exemplos JSON
do contrato de anexos foram conferidos.

Referências: [SDK oficial Oracle](https://github.com/oracle/oci-typescript-sdk),
[ObjectStorageClient](https://docs.oracle.com/en-us/iaas/tools/typescript/latest/classes/_objectstorage_lib_client_.objectstorageclient.html)
e [chaves e fingerprint OCI](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm).
