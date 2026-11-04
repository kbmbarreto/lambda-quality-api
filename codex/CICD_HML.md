# CI/CD de homologação — Lambda Quality

Entrega de 05/10/2026. A pipeline usa o modelo de relatórios existente e permanece
manual. `azure_devops_codereview.yml` não foi alterado nesta entrega. Um modelo
anterior foi usado como referência de infraestrutura, sem copiar seus serviços,
credenciais ou operações de reset.

## Arquivos e sequência

- `azure_devops_hml.yml`: Secrets → SAST → SCA → IaC → testes e imagens →
  aprovação/deploy → rollback manual/opcional.
- `Dockerfile`: targets `runtime` e `migrations`, Node.js 24.15.0 e dependências
  fixadas pelo lockfile. Runtime usa somente dependências de produção; migrations
  inclui a CLI Prisma da mesma versão usada no build.
- `.dockerignore`: contexto por allowlist, excluindo `.env`, chaves, uploads,
  `.git`, dependências locais e Prisma Client gerado na máquina.
- `docker-compose.hml.yml`: API e migrations de execução única, com configurações
  externas, chaves somente leitura e filesystem somente leitura, exceto `/tmp`.
- `deploy/api.env.example`: referência para preencher a Library; não contém
  credenciais reais. Não versionar uma cópia preenchida.
- `scripts/cicd/`: publicação, rollback, integridade do pacote, readiness e testes
  do fluxo com Docker simulado.

## Library de homologação

Criar em **Pipelines → Library → Variable groups** o grupo **`LambdaQuality-HML`**.
Autorizar esta pipeline em **Pipeline permissions**. O deployment job referencia
esse grupo explicitamente; CI/scanners não recebem as credenciais desse grupo.

Use os nomes de `deploy/api.env.example` (e os campos opcionais de `.env.example`)
como nomes de variáveis no grupo. Inserir os valores diretamente, **sem aspas
externas de arquivo `.env`**. O mapeamento no YAML passa cada campo explicitamente
para a geração da configuração. A Library é lida quando o job de deploy começa;
para publicar configuração nova depois de uma release, iniciar um novo run.

| Dados | Variáveis |
| --- | --- |
| Banco | `DATABASE_DIALECT`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`; alternativamente `DATABASE_URL` com credenciais na URL |
| Códigos/convites | `OTP_HMAC_SECRET` ou `JWT_SECRET`; opcional `INVITATION_ENCRYPTION_SECRET` persistente |
| JWT | `JWT_KEY_ID`, `JWT_ISSUER`, `JWT_AUDIENCE` e TTLs opcionais |
| E-mail | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` |
| Front | `CORS_ORIGINS`, `INVITATION_ACCEPT_URL` HTTPS |
| OCI | `LAMBDAQUALITY_STORAGE_ORACLE_REGION`, `..._NAMESPACE`, `..._BUCKET`, `..._TENANCY_OCID`, `..._USER_OCID`, `..._FINGERPRINT` e `LAMBDAQUALITY_STORAGE_PREFIX` |
| Opcionais | Passphrase da chave OCI, TTLs, limites de anexos e tentativas de autenticação, `DB_SSL_CA_PATH` |
| Docker | `LAMBDAQUALITY_HTTP_PORT`, `LAMBDAQUALITY_BIND_ADDRESS`, `LAMBDAQUALITY_DOCKER_NETWORK` |

Marcar como **secret**: `DB_PASSWORD`, `DATABASE_URL` quando contiver senha,
`SENDGRID_API_KEY`, `OTP_HMAC_SECRET`, `JWT_SECRET`,
`INVITATION_ENCRYPTION_SECRET` e passphrase OCI, quando usados.
Os campos obrigatórios ausentes/interpretações de macros não resolvidas interrompem
a publicação antes das migrations; opcionais ausentes mantêm os padrões do servidor.
Atualização de 05/10/2026: variáveis OCI ausentes/inválidas ou PEM OCI indisponível
não bloqueiam deploy/readiness. Anexos responderão `503` até o storage ser corrigido.
Banco, SendGrid/segredos essenciais e chaves JWT continuam sendo validados.

A pipeline não gera `.env` no checkout. Sob o lock do deploy, grava arquivos
privados com permissão `0600` em `config/releases/<release>/`, somente na VM.
O env-file da API usa `format: raw` do Compose **2.30+**, preservando `$`, `#`,
aspas e `=` dentro dos valores sem interpolação. Caracteres de controle/quebras
de linha são rejeitados; não inserir PEM multiline como variável desse grupo.
Retém a configuração por release para que o rollback use também a configuração
anterior, sem depender do estado atual da Library. Esses arquivos não entram no
artifact, checksum público, imagem ou logs. Retenção de configurações privadas
deve acompanhar a retenção das releases e a política de segredos da empresa.

Os **arquivos PEM** são provisionados na pasta protegida `secrets/` da VM.
Os caminhos locais do Mac não são reaproveitados: Compose fixa `/run/secrets/`.
Também fixa `NODE_ENV=production`, `HOST=0.0.0.0`, porta interna `3000` e Swagger
desabilitado. Variáveis de infraestrutura do agente e campos legados não usados
pela API (como `MAIL_HOST`) não são copiados para o container.

SAST foi adaptado de C# para TypeScript/Node.js. Gitleaks usa `current` para conferir
o estado completo publicado, inclusive ao executar na própria branch `develop`.
Os relatórios e resumos dos quatro checks foram preservados. As imagens dos
scanners continuam nas versões configuradas no modelo existente.

**Segurança consultiva, conforme solicitação:** findings continuam gerando códigos
de saída não zero, relatórios e stages vermelhos. Os stages seguintes usam condições
que permitem continuar após falhas de segurança. O responsável avalia os relatórios
na aprovação manual. Assim, um deploy aprovado pode acontecer mesmo quando o status
global do run permanecer vermelho por um check de segurança.

**Validações bloqueantes:** instalação, build, lint, tipos, testes unitários/HTTP,
integração MySQL 8.4.11 e MariaDB 10.11.14, testes do fluxo de publicação e build/smoke
das imagens devem passar. Caso contrário, a release não é publicada e o deploy
não é liberado. Os testes usam o próprio repositório; não há dependência do antigo
repositório externo de testes. JUnit é publicado no Azure DevOps. Integrações usam
Testcontainers e bancos descartáveis; variáveis que permitiriam usar um banco
configurado são explicitamente desativadas.

O smoke da imagem de migrations também executa o entrypoint real contra bancos
MySQL/MariaDB descartáveis, com filesystem somente leitura, e repete a execução
para verificar que não há migrations pendentes. Esse teste nunca lê o `.env` local.

## Como a pipeline escolhe o servidor

No exemplo anterior, `docker compose` rodava diretamente no agente escolhido pelo
pool: esse agente era o servidor de deploy. Um `pool` sozinho não define uma máquina
remota para publicar.

Nesta entrega, CI e scanners usam o pool configurado por `ciPoolName` (padrão `Default`). Deploy e rollback usam um
deployment job com o recurso de VM do Environment:

```yaml
environment:
  name: ${{ parameters.hmlEnvironment }}
  resourceName: ${{ parameters.hmlVmResource }}
  resourceType: virtualMachine
```

O agente **registrado nessa VM** executa os comandos Docker localmente. Não é
necessária uma conexão SSH. O script fixa o socket `/var/run/docker.sock` e remove
o contexto Docker herdado, para não publicar por engano em outro daemon.

Os nomes abaixo são sugestões de provisionamento, não recursos já verificados:

| Parâmetro | Padrão | Configuração necessária |
| --- | --- | --- |
| `ciPoolName` | `Default` | Pool de agentes com Docker, autorizado para a pipeline |
| `hmlEnvironment` | `lambdaquality-hml` | Nome do Environment no Azure DevOps |
| `hmlVmResource` | `lambdaquality-hml-api` | Nome exato da VM registrada nele |
| `hmlDeployRoot` | `/opt/lambdaquality/hml` | Pasta dedicada, gravável pelo agente |
| `dockerPlatform` | `linux/amd64` | Arquitetura real do servidor; também aceita `linux/arm64` |

1. Em Pipelines → Environments, criar o Environment e adicionar um recurso
   **Virtual machines / Linux**. Executar o script de registro fornecido pelo Azure
   no servidor de homologação e instalar o agente como serviço.
2. Conferir o nome exato do recurso e ajustar os parâmetros ao iniciar o run.
   Autorizar a pipeline a usar o Environment e o pool selecionado em `ciPoolName`.
3. Configurar permissões de aprovação para os responsáveis. A aprovação manual
   anterior ao deploy foi preservada. Um exclusive lock no Environment pode
   serializar pipelines; `flock` também impede deploy/rollback simultâneos nesta VM.
4. Cadastrar `azure_devops_hml.yml` como pipeline separada e selecionar a branch
   desejada em **Run pipeline**. O YAML não possui gatilhos automáticos.

Referência: [Azure DevOps — VM resources in Environments](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/environments-virtual-machines?view=azure-devops).

### Instalar o agente no servidor Linux

Em **Pipelines → Environments → New environment**, usar `lambdaquality-hml` e
**Virtual machines → Linux**. Copiar o script gerado e executá-lo no servidor de
destino, como usuário do agente. O token de registro gerado expira em três horas.
Conferir **Resources → Online** após a instalação. Se o script usar o hostname
como nome do recurso, preencher `hmlVmResource` com esse nome real; ou ajustar
o argumento `--agent` do script para `lambdaquality-hml-api` antes de executá-lo.

Se o registro não tiver instalado o serviço, entrar na pasta do agente e executar:

```bash
sudo ./svc.sh install NOME_DO_USUARIO_DO_AGENTE
sudo ./svc.sh start
sudo ./svc.sh status
```

O usuário desse serviço deve acessar Docker sem depender de `sudo` nos comandos
da pipeline. Docker/Compose, Python e util-linux devem estar disponíveis no serviço.
Referência: [agente Linux como serviço](https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/linux-agent?view=azure-devops).

## Pré-requisitos e configuração do servidor

Agente de CI: Linux, Bash, Python 3.9+, Docker e acesso ao daemon, NodeTool, npm,
registries dos scanners/Node e bancos de teste. Compilar para arquitetura diferente
do agente exige suporte de emulação Docker; prefira agentes da mesma arquitetura.

VM de destino: Linux, Bash, Python 3.9+, `flock` (util-linux), gzip, Docker Engine
com socket local padrão e Docker Compose **2.30+** com `up --wait` (validado em 2.30.3).
O usuário do agente precisa acessar Docker e gravar apenas na pasta dedicada.
O servidor precisa alcançar banco, OCI Object Storage e SendGrid.

Provisionar a pasta `secrets/` fora do checkout e dos artifacts. A pipeline cria
as demais pastas e arquivos indicados:

```text
/opt/lambdaquality/hml/
  config/
    releases/
      <releaseId>/
        api.env        # gerado da Library: API, banco, OCI, SendGrid e segredos
        deploy.env     # gerado da Library: porta, bind e rede Docker
  secrets/
    jwt_private.pem    # chave RS256 privada existente
    jwt_public.pem     # chave pública correspondente
    oci_api_key.pem    # chave da OCI correspondente ao fingerprint; necessária para anexos
    database_ca.pem    # opcional, quando usado TLS com CA específica
  releases/            # criado pelo deploy; pacotes retidos para rollback
  state/               # criado pelo deploy; current, active, attempted e locks
```

Usar `deploy/api.env.example` como referência e preencher a Library com os dados de HML.
O Compose injeta os caminhos `/run/secrets` das três chaves. Arquivos precisam ser
legíveis pelo usuário `node` (UID 1000) no container e protegidos no servidor;
conceder acesso por proprietário/grupo apropriado, sem permissões públicas de escrita.
Preservar as chaves JWT, HMAC de códigos, segredo de convites e bucket/prefixo OCI
entre releases. Não gerar novos segredos a cada deploy. Configurações e chaves não
são empacotadas nas imagens ou artifacts, e os scripts não imprimem o ambiente.

O `api.env` gerado usa env-file **raw** do Compose; a pipeline preserva os valores
da Library sem acrescentar aspas ou interpolar `$`. Não adicionar aspas externas
ao cadastrar a senha na Library.
Não imprimir `docker compose config` no log: a saída inclui valores privados.

Dentro do container, `localhost` é o próprio container. Banco nativo no servidor
pode usar `host.docker.internal`, com escuta/firewall que permitam acesso pela rede
Docker; banco remoto usa seu endereço privado real. O Compose não instala banco.
`DATABASE_DIALECT=mariadb` seleciona o histórico MariaDB; `mysql` seleciona MySQL.
Manter o dialeto do banco existente. Não trocar o histórico de um banco inicializado.

Variáveis opcionais de Docker na Library, ilustradas no formato gerado em `deploy.env`:

```dotenv
LAMBDAQUALITY_HTTP_PORT=3000
LAMBDAQUALITY_BIND_ADDRESS=127.0.0.1
LAMBDAQUALITY_DOCKER_NETWORK=proxy
```

A API escuta `0.0.0.0:3000` dentro do container. Por padrão, a porta do host fica
apenas em loopback. Proxy nativo usa `127.0.0.1:3000`; proxy Docker pode entrar na
mesma rede e acessar `api:3000`. Ajustar rede/alias quando a infraestrutura possuir
outros serviços com esse nome. O script cria a rede se ausente; configurar proxy,
DNS, certificado TLS e URL HTTPS do front na infraestrutura. Não há proxy embutido.
Swagger está desabilitado nesse Compose de homologação.

## Release, migrations e readiness

Após os testes, CI constrói ambas as imagens, verifica seus entrypoints e publica
o artifact `backend-release`. A identificação é `BuildId-CommitSHA`. O pacote contém
as imagens em `images.tar.gz`, Compose, scripts, IDs Docker e SHA-256 dos arquivos.
Isso permite distribuir a release sem configurar um container registry. Reserve
espaço e retenção suficientes para esses artifacts e releases no servidor.

Na VM, o deploy:

1. Adquire o lock, verifica o artifact e prepara a configuração privada da Library.
   Campos obrigatórios ausentes ou alteração de configuração no retry da mesma
   release interrompem a publicação. Os IDs das imagens são conferidos após carga.
2. Carrega as imagens do artifact; não recompila nem baixa dependências no destino.
3. Executa preflight de configuração essencial e par RSA de JWT, sem iniciar
   HTTP/worker e antes de alterar o banco. Não consulta OCI: storage é verificado
   na operação de arquivo, permitindo funcionamento dos demais módulos em falha.
4. Registra o predecessor e executa `npm run migration:deploy` no container
   `migrations` da release. Somente migrations versionadas pendentes são aplicadas.
5. Atualiza a API via Compose e aguarda o healthcheck de `/api/v1/health/ready`,
   que verifica banco/esquema. Registra a release como `current` após readiness.

Se a migration falhar, não há comando de substituição da API anterior. MySQL e
MariaDB podem aplicar DDL parcialmente antes de uma falha: investigar e recuperar
com procedimentos de banco e Prisma antes de tentar novamente. Os scripts não
executam reset, `migrate dev`, `db push`, `down -v` ou exclusão global de imagens.

Se a nova API falhar na readiness, o deploy falha e registra a publicação pendente.
Outro run não pode sobrescrever esse estado até a recuperação/rollback. O rollback
continua manual, conforme solicitado. A substituição por Compose pode causar uma
breve indisponibilidade; esta entrega não implementa publicação sem interrupção.
A API habilita shutdown hooks para encerrar recursos ao receber SIGTERM do Docker.

## Rollback manual/opcional

Acionar o stage **7. Rollback Backend - Homologação** no mesmo run que tentou
publicar. Ele usa o mesmo Environment/VM e restaura as imagens e a configuração
privada da release anterior, conferindo integridade e readiness. Um run antigo não pode fazer rollback
se houver tentativa mais recente. Primeiro deploy não possui predecessor; nesse
caso o script interrompe com mensagem explícita. Não apagar releases usadas como
predecessor enquanto o rollback ainda puder ser necessário.

**Rollback restaura a aplicação, sem reverter migrations ou dados.** Planejar
migrations compatíveis com a versão anterior e backup antes do deploy. Alterações
incompatíveis exigem recuperação de banco específica; não há rollback SQL automático.
Uma nova tentativa do mesmo run já publicado e saudável não reaplica migrations.

`trigger: manual` usa o recurso de stages manuais do Azure DevOps. Confirmar suporte
se a organização usar uma versão antiga do Azure DevOps Server; validar o YAML no
editor Azure antes de executar. Referência: [stage schema](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/stages-stage?view=azure-pipelines).

## Validação desta entrega

- Build TypeScript, lint e tipos aprovados com Node.js 24.15.0.
- 74 testes unitários/HTTP, 90 integrações MySQL 8.4.11 e 90 integrações MariaDB
  10.11.14 aprovados. JUnit gerado com as mesmas opções usadas na pipeline.
- 14 testes do fluxo de publicação aprovados: ordem migration/publicação,
  falhas de preflight/migration/readiness, concorrência, corrupção do artifact,
  imagem divergente, retries, primeiro deploy, rollback obsoleto, preparação da
  Library, permissões privadas, segredos literais, macros ausentes/injeção de linhas
  e preservação da configuração anterior no rollback.
  Inclui deploy sem variáveis/PEM OCI, preservando as validações essenciais.
- Leitura real de env-file `raw` no Compose/Docker preservou senha fictícia com
  `$`, `#`, aspas e `=` sem exibir os valores no log.
- Ambas as imagens construídas localmente em Linux ARM64 via Docker Desktop.
  Runtime importado com UID 1000/filesystem somente leitura, sem `.env`, `.local`
  ou código-fonte local; healthcheck aceitou readiness saudável e rejeitou HTTP 503.
- Runtime atualizado iniciou com MySQL descartável e chaves JWT fictícias, sem
  configuração/PEM OCI: readiness 200 e login inválido 401. Uploads com erro de
  storage retornam 503 conforme as integrações HTTP; não bloqueiam o startup.
- Imagem real de migrations aplicada aos dois bancos descartáveis com filesystem
  somente leitura; segunda execução sem migrations pendentes em ambos.
- YAML da pipeline e Compose parseados, Compose validado com `config --quiet`,
  17 blocos Bash do YAML e scripts de deploy/rollback verificados com `bash -n`.

A execução inicial de HTTP no sandbox não pôde abrir sockets locais; a repetição
com a permissão apropriada passou. Nenhum schema da aplicação foi alterado.

Parse local de YAML verifica sintaxe, mas não valida recursos, permissões, aprovação
ou execução no Azure DevOps. Não foram executados os quatro scanners no Azure nem
um deploy/rollback no servidor real; esses dependem da infraestrutura configurada.
A VM, o Environment e o proxy devem ser provisionados antes do primeiro deploy.

## Cofre de testes — 06/10/2026

Adicionar TEST_VAULT_ACTIVE_KEY_ID (padrão v1) e TEST_VAULT_ENCRYPTION_KEYS (**secret**,
JSON de chaves base64 de 32 bytes) à Library LambdaQuality-HML. Mapeamento explícito
no deploy preserva o valor no env-file raw/0600, sem logs ou inclusão no artifact.
[Gerar/proteger/rotacionar chaves](PRODUCT_IMPROVEMENTS_20261006.md). Ausência/invalidez
não bloqueia startup/deploy; gravação/revelação de credenciais responde 503. Manter
as chaves antigas disponíveis também para backups e rollback de configurações.

### Operação em 08/10/2026

WORKSPACE_RATE_LIMIT pode permanecer na Library/pipeline por compatibilidade,
mas é ignorado pela API: operações autenticadas não têm quota geral por minuto.
AUTH_RATE_LIMIT/AUTH_RATE_WINDOW_SECONDS continuam protegendo as rotas públicas
de autenticação e refresh; o cooldown de convites continua válido.

Validar TEST_VAULT_ENCRYPTION_KEYS antes do deploy: JSON por ID, chaves Base64
canônicas de 32 bytes, active ID correspondente. `npm run vault:check` não
imprime chaves nem conecta ao banco; também disponível na imagem runtime.
Para o .env local, `npm run setup:vault-key` adiciona uma chave com novo ID
sem substituir chaves antigas e sem exibi-las. Atualizar os valores da Library
com os respectivos valores privados, preservando chaves antigas, e publicar a
configuração/reiniciar a API. A imagem continua sem conter chaves/.env.
