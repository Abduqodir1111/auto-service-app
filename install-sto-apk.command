#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/install-sto-apk.commond"

echo
echo "Press Enter to close this window."
read -r _

