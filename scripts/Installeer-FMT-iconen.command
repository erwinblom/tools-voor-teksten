#!/bin/sh
set -eu
fmt_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$fmt_dir/runtime/node" "$fmt_dir/installeer-dock.mjs" "$@"
printf '\nDruk op Enter om dit venster te sluiten.\n'
read fmt_done
