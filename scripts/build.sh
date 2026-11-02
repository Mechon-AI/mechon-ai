#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Building Mechon AI Workstation ==="

# 1. Build Frontend
echo "[1/3] Building React Frontend..."
cd "$PROJECT_ROOT/frontend"
npm run build

# 2. Build Tauri Desktop Binary
echo "[2/3] Building Native Desktop Tauri Binary..."
cd "$PROJECT_ROOT/src-tauri"
cargo build --release

# 3. Verify Output
BIN_PATH="$PROJECT_ROOT/src-tauri/target/release/mechon-ai"
if [ -f "$BIN_PATH" ]; then
    echo "[3/3] Build succeeded!"
    ls -lh "$BIN_PATH"
else
    echo "Error: Native executable not found at $BIN_PATH"
    exit 1
fi
