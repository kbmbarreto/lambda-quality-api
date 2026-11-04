#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIRECTORY=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIRECTORY/deploy-common.sh"
[[ $# -eq 3 ]] || fail 'Uso: deploy-hml.sh ROOT ARTIFACT RELEASE_ID'
initialize "$1"
artifact=$2
candidate=$3
valid_release "$candidate"
python3 "$SCRIPT_DIRECTORY/release.py" verify "$artifact" "$candidate"

current=$(read_state current)
active=$(read_state active)
if [[ -n "$active" && "$active" != "$current" ]]; then
  fail 'Há uma publicação não confirmada. Resolva o rollback/incidente antes de outro deploy.'
fi
if [[ "${LAMBDAQUALITY_CONFIG_SOURCE:-server}" == library ]]; then
  python3 "$SCRIPT_DIRECTORY/prepare-config.py" "$ROOT" "$candidate"
fi
directory="$ROOT/releases/$candidate"
if [[ -d "$directory" ]]; then
  cmp "$artifact/SHA256SUMS" "$directory/SHA256SUMS" || fail 'Não é permitido substituir uma release existente.'
else
  mkdir "$directory"
  cp -R "$artifact/." "$directory/"
fi
python3 "$SCRIPT_DIRECTORY/release.py" verify "$directory" "$candidate"
gzip -dc "$directory/images.tar.gz" | docker image load >/dev/null
use_release "$candidate"
ensure_network

if [[ "$current" == "$candidate" ]]; then
  compose exec -T api node scripts/cicd/healthcheck.mjs
  echo 'Release já publicada e saudável; nenhuma migration ou troca de API necessária.'
  exit 0
fi

# Preflight sem iniciar HTTP ou worker; falha antes de qualquer alteração no banco.
compose run --rm --no-deps -T api node --input-type=module -e '
import {loadConfig} from "./dist/shared/config/config.js";
try { loadConfig(); }
catch { console.error("Configuração essencial de runtime inválida."); process.exitCode = 1; }
'

# Registrar o predecessor somente uma vez para permitir retries deste run.
if [[ ! -e "$ROOT/state/rollback/$candidate" ]]; then
  printf '%s\n' "$current" >"$ROOT/state/rollback/$candidate"
fi
write_state attempted "$candidate"
echo 'Aplicando migrations versionadas; a API anterior permanece em execução.'
compose --profile migrate run --rm --no-deps -T migrations

# Nunca executar migrate dev, reset, db push, down -v ou limpeza global do Docker.
write_state active "$candidate"
echo 'Iniciando a nova API e verificando readiness.'
start_api
if [[ -n "$current" ]]; then write_state previous "$current"; fi
write_state current "$candidate"
echo "Deploy concluído: $candidate. Readiness validado."
