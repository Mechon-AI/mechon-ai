#!/bin/bash
set -e

echo "=== Mechon AI Workstation Setup ==="
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "1. Checking Python environment..."
cd "$PROJECT_ROOT/backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv --system-site-packages
fi
.venv/bin/pip install -r requirements.txt

echo "2. Setting up Frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "=== Setup Complete! ==="
echo "Run './scripts/dev.sh' to launch development mode."
