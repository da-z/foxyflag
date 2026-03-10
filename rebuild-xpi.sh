#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUTPUT="$ROOT_DIR/foxyflag.xpi"

cd "$ROOT_DIR"
rm -f "$OUTPUT"

zip -q -r "$OUTPUT" manifest.json background.js icons
printf '%s\n' "$OUTPUT"
