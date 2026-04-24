#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Destino do deploy (sobrescreva sem editar o script):
#   SERVER_HOST=   IP ou hostname
#   SERVER_USER=   usuario SSH (default root)
#   SSH_PORT=      porta SSH (default 22)
#   REMOTE_DIR=    pasta no servidor
# Só build + .tar, sem SSH:
#   SKIP_REMOTE=1 ./deploy.sh 1.2.3
#
# IP por defeito: 192.168.1.200 (ajuste a sub-rede ou defina no env):
#   SERVER_HOST="10.20.30.231" ./deploy.sh 1.0.0
#   SERVER_HOST=207.244.252.170 ./deploy.sh 1.0.0
SERVER_HOST="${SERVER_HOST:-192.168.1.200}"
SERVER_USER="${SERVER_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
SSH_OPTS=(
  -o "ConnectTimeout=${SSH_CONNECT_TIMEOUT:-25}"
  -o "ServerAliveInterval=10"
  -o "ServerAliveCountMax=3"
)
REMOTE_DIR="${REMOTE_DIR:-/root/vera-trajes-deploy}"
STACK_NAME="vera-trajes"

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: docker nao encontrado no ambiente local."
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "Erro: ssh nao encontrado no ambiente local."
  exit 1
fi

if ! command -v scp >/dev/null 2>&1; then
  echo "Erro: scp nao encontrado no ambiente local."
  exit 1
fi

VERSION="${1:-}"
if [[ -z "${VERSION}" ]]; then
  read -r -p "Informe a versao (ex: 1.0.0): " VERSION
fi

if [[ -z "${VERSION}" ]]; then
  echo "Erro: versao nao informada."
  exit 1
fi

API_IMAGE="vera-trajes-api:${VERSION}"
WEB_IMAGE="vera-trajes-web:${VERSION}"

ARTIFACTS_DIR="${ROOT}/.artifacts"
API_TAR="${ARTIFACTS_DIR}/vera-trajes-api_${VERSION}.tar"
WEB_TAR="${ARTIFACTS_DIR}/vera-trajes-web_${VERSION}.tar"
API_TAR_BN="$(basename "${API_TAR}")"
WEB_TAR_BN="$(basename "${WEB_TAR}")"

echo "==> Buildando imagens para Linux amd64 (Ubuntu server)"
docker build --platform linux/amd64 -t "${API_IMAGE}" "${ROOT}/backend"
docker build --platform linux/amd64 -t "${WEB_IMAGE}" "${ROOT}/frontend"

echo "==> Gerando arquivos .tar"
mkdir -p "${ARTIFACTS_DIR}"
docker save -o "${API_TAR}" "${API_IMAGE}"
docker save -o "${WEB_TAR}" "${WEB_IMAGE}"

if [[ "${SKIP_REMOTE:-0}" == "1" ]]; then
  echo "==> SKIP_REMOTE=1 — deploy ignorado."
  echo "    Artefatos: ${API_TAR} ${WEB_TAR}"
  echo "    Envie manualmente ou rode de novo com rede até ${SERVER_USER}@${SERVER_HOST}:${SSH_PORT}"
  exit 0
fi

echo "==> Deploy remoto: ${SERVER_USER}@${SERVER_HOST}:${SSH_PORT} -> ${REMOTE_DIR}"
echo "==> Criando diretorio remoto"
if ! ssh "${SSH_OPTS[@]}" -p "${SSH_PORT}" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_DIR}"; then
  echo ""
  echo "Erro: nao foi possivel conectar via SSH (timeout, firewall, IP errado ou porta fechada)."
  echo "  - Confira IP/hostname e se a porta ${SSH_PORT} aceita sua rede atual."
  echo "  - Para gerar só as imagens e .tar sem deploy: SKIP_REMOTE=1 $0 ${VERSION}"
  echo "  - Para outro servidor: SERVER_HOST=... SSH_PORT=... $0 ${VERSION}"
  exit 1
fi

echo "==> Enviando arquivos para o servidor"
scp "${SSH_OPTS[@]}" -P "${SSH_PORT}" "${API_TAR}" "${WEB_TAR}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"
scp "${SSH_OPTS[@]}" -P "${SSH_PORT}" "${ROOT}/docker-stack.yml" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/docker-stack.yml"

echo "==> Carregando imagens e publicando stack no servidor"
# Heredoc sem aspas: REMOTE_DIR, VERSION, etc. expandem no ambiente local antes de enviar ao SSH.
ssh "${SSH_OPTS[@]}" -p "${SSH_PORT}" "${SERVER_USER}@${SERVER_HOST}" "bash -s" <<EOF
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "Erro: Docker indisponivel no servidor."
  exit 1
fi

if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q 'active'; then
  echo "Swarm inativo. Inicializando..."
  docker swarm init >/dev/null 2>&1 || true
fi

if ! docker network inspect main_network >/dev/null 2>&1; then
  echo "Criando network externa main_network..."
  docker network create -d overlay --attachable main_network
fi

cd "${REMOTE_DIR}"
docker load -i "${API_TAR_BN}"
docker load -i "${WEB_TAR_BN}"

export APP_VERSION="${VERSION}"
cd "${REMOTE_DIR}" && docker stack deploy -c docker-stack.yml "${STACK_NAME}"
docker stack services "${STACK_NAME}"
EOF

echo "==> Deploy finalizado com versao ${VERSION}"
