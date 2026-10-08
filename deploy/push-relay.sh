#!/bin/sh
# Copies the relay's code to the server and restarts it. Run from anywhere:
#   deploy/push-relay.sh [ssh-host]
# The repository is private, so the server does not pull from GitHub; only the files the relay
# needs are sent from this machine.
set -e
HOST="${1:-plonko-vm}"
cd "$(dirname "$0")/.."

rsync -az --delete \
  --include='/package.json' --include='/package-lock.json' \
  --include='/server/***' --include='/shared/***' \
  --include='/client/' --include='/client/package.json' \
  --exclude='node_modules' --exclude='*' \
  ./ "$HOST:Plonko/"

ssh "$HOST" 'cd Plonko && npm ci --workspace=@plonko/server --no-audit --no-fund && (sudo systemctl restart plonko-relay 2>/dev/null || true)'
echo "Relay code is on $HOST."
