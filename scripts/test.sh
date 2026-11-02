#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Running Mechon AI Automated Test Suite ==="

# 1. Rust Native Tests
echo "[1/3] Running Rust Core Integration Tests..."
cd "$PROJECT_ROOT/src-tauri"
cargo test --test core_tests

echo "[2/3] Running Provider Registry & Secure Vault Tests..."
cargo test --test provider_vault_tests

# 2. Frontend Build and TypeScript Verification
echo "[3/3] Verifying Frontend TypeScript & Production Build..."
cd "$PROJECT_ROOT/frontend"
npm run build

echo "=== All Tests Passed Successfully! ==="
