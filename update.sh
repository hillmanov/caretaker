#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# The glob catches the text bun.lock if bun ever replaces the binary bun.lockb.
state() { git rev-parse HEAD; cat server/go.mod server/go.sum client/bun.lock* | sha256sum; }
before=$(state)

git rev-parse --abbrev-ref @{u} >/dev/null 2>&1 && git pull --ff-only

(cd server && go get -u ./... && go mod tidy)
(cd client && bun update)

if [ "$(state)" = "$before" ]; then
  echo "caretaker: already current"
  exit 0
fi

(cd server && go build -o caretaker .)
(cd client && bun run build)
pm2 restart Caretaker >/dev/null && echo "Caretaker: restarted"
