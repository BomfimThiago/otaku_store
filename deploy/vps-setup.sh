#!/usr/bin/env bash
#
# One-shot setup for a fresh Ubuntu 22/24 VPS (e.g. Hetzner CX22, 4 GB) that hosts:
#   - the OtakuVerso store           → http://<ip>:3000
#   - the Minion Console + trigger   → http://<ip>:8787   (judges can run it live)
#
# Usage (as root):
#   1) create the box, ssh in
#   2) mkdir -p /opt/otaku && git clone https://github.com/BomfimThiago/otaku_store.git /opt/otaku/otaku_store
#   3) create /opt/otaku/otaku_store/.env  (see REQUIRED ENV below) — never commit it
#   4) bash /opt/otaku/otaku_store/deploy/vps-setup.sh
#
# REQUIRED ENV in /opt/otaku/otaku_store/.env:
#   GITHUB_TOKEN=ghp_...       # repo: contents + pull requests
#   ANTHROPIC_API_KEY=sk-ant-... # SET A LOW SPENDING CAP in the Anthropic console!
#   TAVILY_API_KEY=tvly-...    # official-sources context
#   TRIGGER_TOKEN=some-secret  # optional: if set, the console URL needs ?token=some-secret
#
set -euo pipefail

REPO_URL="https://github.com/BomfimThiago/otaku_store.git"
APP_DIR="/opt/otaku/otaku_store"
STORE_PORT="${STORE_PORT:-3000}"
CONSOLE_PORT="${CONSOLE_PORT:-8787}"

echo "==> 1/8 system packages (node 20, git, gh, python3)"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg python3
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
if ! command -v gh >/dev/null 2>&1; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -y && apt-get install -y gh
fi

echo "==> 2/8 repo at $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone "$REPO_URL" "$APP_DIR"; fi

echo "==> 3/8 load .env"
[ -f "$APP_DIR/.env" ] || { echo "!! create $APP_DIR/.env first (see this script's header)"; exit 1; }
set -a; . "$APP_DIR/.env"; set +a
: "${GITHUB_TOKEN:?set GITHUB_TOKEN in .env}"
: "${ANTHROPIC_API_KEY:?set ANTHROPIC_API_KEY in .env}"

echo "==> 4/8 gh auth (so https clone + push work non-interactively)"
echo "$GITHUB_TOKEN" | gh auth login --with-token
gh auth setup-git

echo "==> 5/8 drop the Playwright MCP (heavy browser download; only used in E2E recovery)"
python3 - "$APP_DIR/.mcp.json" <<'PY' || true
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d.get("mcpServers", {}).pop("playwright", None)
json.dump(d, open(p, "w"), indent=2)
PY

echo "==> 6/8 install deps + build the store (this is the slow part)"
( cd "$APP_DIR/minion" && npm install --no-audit --no-fund )
( cd "$APP_DIR/store"  && npm install --no-audit --no-fund && npm run build )

echo "==> 7/8 systemd services (auto-restart, survive reboot)"
cat >/etc/systemd/system/otaku-store.service <<EOF
[Unit]
Description=OtakuVerso store (API + SPA)
After=network.target
[Service]
WorkingDirectory=$APP_DIR/store
EnvironmentFile=$APP_DIR/.env
Environment=PORT=$STORE_PORT
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/otaku-console.service <<EOF
[Unit]
Description=Minion Console (live trigger)
After=network.target
[Service]
WorkingDirectory=$APP_DIR/minion
EnvironmentFile=$APP_DIR/.env
Environment=MINION_REPO_SOURCE=$REPO_URL
ExecStart=/usr/bin/npx tsx src/index.ts dashboard --port $CONSOLE_PORT --enable-trigger
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now otaku-store otaku-console

echo "==> 8/8 firewall (also open these ports in the Hetzner Cloud firewall)"
if command -v ufw >/dev/null 2>&1; then ufw allow "$STORE_PORT"/tcp || true; ufw allow "$CONSOLE_PORT"/tcp || true; fi

IP="$(curl -s ifconfig.me || echo '<vps-ip>')"
echo
echo "================================================================"
echo " Store:   http://$IP:$STORE_PORT"
echo " Console: http://$IP:$CONSOLE_PORT${TRIGGER_TOKEN:+/?token=$TRIGGER_TOKEN}"
echo "================================================================"
echo "logs:  journalctl -u otaku-console -f   |   journalctl -u otaku-store -f"
echo "update: git -C $APP_DIR pull && systemctl restart otaku-store otaku-console"
