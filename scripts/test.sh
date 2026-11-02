#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Running Mechon AI Test Suite ==="

# 1. Backend unit and integration tests
echo "[1/2] Running Backend Pytest Suite..."
cd "$PROJECT_ROOT/backend"
.venv/bin/pytest -v

# 2. Frontend compilation and bundle test
echo "[2/2] Verifying Frontend TypeScript & Production Build..."
cd "$PROJECT_ROOT/frontend"
npm run build

echo "=== All Tests Passed Successfully! ==="
