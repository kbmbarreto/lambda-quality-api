#!/usr/bin/env bash
# Biblioteca do deploy/rollback. Só usa o Docker local da VM do Environment.
set -euo pipefail
umask 077

fail() { echo "ERRO: $*" >&2; exit 1; }
valid_release() { [[ "$1" =~ ^[0-9]+-[a-f0-9]{40}$ ]] || fail 'Release inválida.'; }

initialize() {
  ROOT=$1
  [[ "$ROOT" =~ ^/[a-zA-Z0-9_./-]+$ && "$ROOT" != / && "$ROOT" != /opt && "/${ROOT#/}/" != *'/../'* && "/${ROOT#/}/" != *'/./'* ]] || fail 'Use uma pasta absoluta dedicada ao deploy.'
  [[ -d "$ROOT/secrets" ]] || fail 'Provisione a pasta secrets na VM.'
  for key in jwt_private.pem jwt_public.pem; do
    [[ -f "$ROOT/secrets/$key" ]] || fail 'Uma das chaves obrigatórias não foi provisionada.'
  done
  mkdir -p "$ROOT/releases" "$ROOT/state/rollback"
  exec 9>"$ROOT/state/deploy.lock"
  flock -n 9 || fail 'Outro deploy ou rollback está em andamento nesta VM.'
  export DOCKER_HOST=unix:///var/run/docker.sock
  unset DOCKER_CONTEXT
  docker info >/dev/null
  docker compose version >/dev/null
  export LAMBDAQUALITY_ENV_FILE="$ROOT/config/api.env"
  export LAMBDAQUALITY_SECRETS_DIRECTORY="$ROOT/secrets"
  COMPOSE_ENV=/dev/null
  if [[ -f "$ROOT/config/deploy.env" ]]; then COMPOSE_ENV="$ROOT/config/deploy.env"; fi
}

read_state() {
  if [[ -f "$ROOT/state/$1" ]]; then
    local value
    value=$(cat "$ROOT/state/$1")
    valid_release "$value"
    printf '%s' "$value"
  fi
}
write_state() {
  local name=$1 value=$2
  valid_release "$value"
  printf '%s\n' "$value" >"$ROOT/state/$name.tmp"
  mv "$ROOT/state/$name.tmp" "$ROOT/state/$name"
}

use_release() {
  RELEASE_ID=$1
  valid_release "$RELEASE_ID"
  RELEASE_DIRECTORY="$ROOT/releases/$RELEASE_ID"
  python3 "$RELEASE_DIRECTORY/scripts/cicd/release.py" verify "$RELEASE_DIRECTORY" "$RELEASE_ID"
  local config="$ROOT/config/releases/$RELEASE_ID"
  if [[ -f "$config/api.env" ]]; then
    export LAMBDAQUALITY_ENV_FILE="$config/api.env"
    COMPOSE_ENV="$config/deploy.env"
  else
    export LAMBDAQUALITY_ENV_FILE="$ROOT/config/api.env"
    COMPOSE_ENV=/dev/null
    if [[ -f "$ROOT/config/deploy.env" ]]; then COMPOSE_ENV="$ROOT/config/deploy.env"; fi
  fi
  [[ -f "$LAMBDAQUALITY_ENV_FILE" ]] || fail 'Configuração privada da release não foi provisionada.'
  export LAMBDAQUALITY_API_IMAGE
  export LAMBDAQUALITY_MIGRATIONS_IMAGE
  LAMBDAQUALITY_API_IMAGE=$(python3 "$RELEASE_DIRECTORY/scripts/cicd/release.py" image "$RELEASE_DIRECTORY" "$RELEASE_ID" api tag)
  LAMBDAQUALITY_MIGRATIONS_IMAGE=$(python3 "$RELEASE_DIRECTORY/scripts/cicd/release.py" image "$RELEASE_DIRECTORY" "$RELEASE_ID" migrations tag)
  for kind in api migrations; do
    local tag expected actual
    tag=$(python3 "$RELEASE_DIRECTORY/scripts/cicd/release.py" image "$RELEASE_DIRECTORY" "$RELEASE_ID" "$kind" tag)
    expected=$(python3 "$RELEASE_DIRECTORY/scripts/cicd/release.py" image "$RELEASE_DIRECTORY" "$RELEASE_ID" "$kind" id)
    actual=$(docker image inspect --format '{{.Id}}' "$tag")
    [[ "$actual" == "$expected" ]] || fail 'A imagem instalada não corresponde ao artifact validado.'
  done
}
compose() {
  docker compose --project-name lambdaquality-hml --env-file "$COMPOSE_ENV" \
    --file "$RELEASE_DIRECTORY/docker-compose.hml.yml" "$@"
}
ensure_network() {
  local network
  # O JSON completo contém env vars privadas: apenas o nome sai do pipe.
  network=$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["networks"]["backend"]["name"])')
  [[ "$network" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || fail 'Nome de rede Docker inválido.'
  if ! docker network inspect "$network" >/dev/null 2>&1; then docker network create "$network" >/dev/null; fi
}
start_api() {
  compose up -d --no-build --wait --wait-timeout 180 api
  compose exec -T api node scripts/cicd/healthcheck.mjs
}
