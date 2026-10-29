#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# go get -u takes modernc.org/libc past the version modernc.org/sqlite is built against, and, where PocketBase runs
# the driver, sqlite past the version PocketBase is tested with. pin_sqlite puts both back.
requires() { go mod graph | awk -v m="$1@$(go list -m -f '{{.Version}}' "$1")" -v d="$2@" '$1 == m && index($2, d) == 1 { print substr($2, length(d) + 1) }'; }
pin_sqlite() {
  if go list -m github.com/pocketbase/pocketbase >/dev/null 2>&1; then
    go get "modernc.org/sqlite@$(requires github.com/pocketbase/pocketbase modernc.org/sqlite)"
  fi
  go get "modernc.org/libc@$(requires modernc.org/sqlite modernc.org/libc)"
  go mod tidy
}

# The glob catches the text bun.lock if bun ever replaces the binary bun.lockb.
state() { git rev-parse HEAD; cat server/go.mod server/go.sum client/bun.lock* | sha256sum; }
before=$(state)

git rev-parse --abbrev-ref @{u} >/dev/null 2>&1 && git pull --ff-only

(cd server && go get -u ./... && go mod tidy && pin_sqlite)
(cd client && bun update)

if [ "$(state)" = "$before" ]; then
  echo "caretaker: already current"
  exit 0
fi

(cd server && go build -o caretaker .)
(cd client && bun run build)
pm2 restart Caretaker >/dev/null && echo "Caretaker: restarted"
