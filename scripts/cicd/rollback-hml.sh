#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIRECTORY=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIRECTORY/deploy-common.sh"
[[ $# -eq 2 ]] || fail 'Uso: rollback-hml.sh ROOT RELEASE_ID_DO_RUN'
initialize "$1"
candidate=$2
valid_release "$candidate"
[[ "$(read_state attempted)" == "$candidate" ]] || fail 'Este run não é a última tentativa de deploy; rollback antigo recusado.'
[[ -f "$ROOT/state/rollback/$candidate" ]] || fail 'Predecessor desta release não foi registrado.'
previous=$(cat "$ROOT/state/rollback/$candidate")
[[ -n "$previous" ]] || fail 'Primeiro deploy: não há versão anterior para restaurar.'
valid_release "$previous"
active=$(read_state active)
[[ "$active" == "$candidate" || "$active" == "$previous" ]] || fail 'Outra release está ativa; rollback recusado.'

directory="$ROOT/releases/$previous"
python3 "$SCRIPT_DIRECTORY/release.py" verify "$directory" "$previous"
gzip -dc "$directory/images.tar.gz" | docker image load >/dev/null
use_release "$previous"
ensure_network
echo 'Restaurando a aplicação anterior. Migrations e dados não serão revertidos.'
start_api
write_state active "$previous"
write_state current "$previous"
echo "Rollback concluído: $previous. Readiness validado."
