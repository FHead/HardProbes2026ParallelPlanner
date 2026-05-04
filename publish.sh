#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

python3 web/build_data.py
mkdir -p docs
cp web/index.html web/style.css web/app.js web/data.js docs/

echo "Published current web assets to docs/."
echo "Next steps:"
echo "  git add ."
echo "  git commit -m \"Update planner\""
echo "  git push"
