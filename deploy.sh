#!/usr/bin/env bash
# deploy.sh — Build and run LearnOS
#
# Usage:
#   ./deploy.sh           Build frontend + start backend on :3001
#   ./deploy.sh --dev     Vite dev server on :3000 (hot-reload, no build needed)
#   ./deploy.sh --reset   Wipe the SQLite DB and re-seed before starting
#   ./deploy.sh --stop    Kill whatever is running on :3001

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

bold=$(tput bold 2>/dev/null || true); reset=$(tput sgr0 2>/dev/null || true)
cyan="\033[0;36m"; green="\033[0;32m"; yellow="\033[1;33m"; red="\033[0;31m"; nc="\033[0m"
step() { echo -e "\n${cyan}${bold}▶ $*${reset}${nc}"; }
ok()   { echo -e "${green}  ✓ $*${nc}"; }
warn() { echo -e "${yellow}  ⚠ $*${nc}"; }
die()  { echo -e "${red}  ✗ $*${nc}"; exit 1; }

# ── flags ─────────────────────────────────────────────────────────────────────
MODE="prod"; RESET=false
for arg in "$@"; do
  case "$arg" in
    --dev)   MODE="dev"  ;;
    --reset) RESET=true  ;;
    --stop)
      step "Stopping LearnOS"
      lsof -ti :3001 | xargs kill -9 2>/dev/null && ok "Stopped" || warn "Nothing running on :3001"
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ── prereqs ───────────────────────────────────────────────────────────────────
step "Checking prerequisites"
command -v node >/dev/null 2>&1 || die "Node.js not found — https://nodejs.org"
command -v npm  >/dev/null 2>&1 || die "npm not found"
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[[ "$NODE_MAJOR" -ge 18 ]] || die "Node.js 18+ required (found $(node -v))"
ok "Node.js $(node -v) / npm $(npm -v)"

# ── dependencies ──────────────────────────────────────────────────────────────
step "Installing dependencies"
if [[ ! -d node_modules ]]; then
  npm install --silent && ok "Installed"
else
  ok "node_modules present (run 'npm install' to update)"
fi

# ── reset DB ──────────────────────────────────────────────────────────────────
if $RESET; then
  step "Resetting database"
  rm -f db/learnos.db db/learnos.db-shm db/learnos.db-wal
  ok "Database wiped — will re-seed on start"
fi

# ── dev mode ──────────────────────────────────────────────────────────────────
if [[ "$MODE" == "dev" ]]; then
  step "Starting in dev mode"
  echo -e "  ${bold}Frontend:${reset} http://localhost:3000  (Vite HMR)"
  echo -e "  ${bold}Backend: ${reset} http://localhost:3001  (run in a separate terminal)"
  echo ""
  npm run dev -- --port 3000
  exit 0
fi

# ── build ─────────────────────────────────────────────────────────────────────
step "Building frontend"
npm run build 2>&1 | grep -v "^$" | sed 's/^/  /'
ok "Build complete → dist/"

# ── free port ─────────────────────────────────────────────────────────────────
if lsof -ti :3001 >/dev/null 2>&1; then
  warn "Port 3001 in use — stopping existing process"
  lsof -ti :3001 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── start ─────────────────────────────────────────────────────────────────────
step "Starting LearnOS"
echo ""
echo -e "  ${bold}Open  http://localhost:3001${reset}"
echo -e "  Dev login:   ${cyan}alex@learnos.dev${nc} / ${cyan}learnos123${nc}"
echo -e "  Fresh start: ${yellow}./deploy.sh --reset${nc}"
echo -e "  Dev mode:    ${yellow}./deploy.sh --dev${nc}"
echo -e "  Stop:        ${yellow}./deploy.sh --stop${nc}"
echo ""
trap 'echo ""; echo "  👋 LearnOS stopped."; exit 0' INT TERM
PORT=3001 node server.js
