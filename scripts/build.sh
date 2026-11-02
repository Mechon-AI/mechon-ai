#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Building Mechon AI Desktop Workstation (Native Rust + React) ==="

# 1. Build Frontend
echo "[1/2] Building React Frontend with Vite..."
cd "$PROJECT_ROOT/frontend"
npm run build

# 2. Build Tauri Desktop Binary
echo "[2/2] Compiling Native Rust Desktop Application..."
cd "$PROJECT_ROOT/src-tauri"
cargo build --release

# 3. Verify Output
BIN_PATH="$PROJECT_ROOT/src-tauri/target/release/mechon-ai"
if [ -f "$BIN_PATH" ]; then
    echo "=== Build Succeeded! ==="
    ls -lh "$BIN_PATH"
else
    echo "Error: Native executable not found at $BIN_PATH" >&2
    exit 1
fi
