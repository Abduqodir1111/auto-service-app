#!/bin/zsh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exit_code=0
"$SCRIPT_DIR/install-sto-apk.sh" || exit_code=$?

echo
echo "Press Enter to close this window."
read -r _

exit "$exit_code"
