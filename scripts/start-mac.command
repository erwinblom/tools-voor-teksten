#!/bin/sh
# Portable launcher: paths are resolved relative to this file, including spaces.
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  printf '%s\n' 'Deze download is voor Mac met Apple Silicon (M1 of nieuwer).' 'Gebruik voor een andere computer de online versie of de broncode.'
  exit 1
fi
if [ ! -x "$package_dir/runtime/node" ] || [ ! -f "$package_dir/app/index.html" ]; then
  printf '%s\n' 'Het pakket is niet volledig uitgepakt. Pak de hele ZIP opnieuw uit en open Start.command uit die map.'
  exit 1
fi
exec "$package_dir/runtime/node" "$package_dir/runtime/local-server.mjs" "$@"
