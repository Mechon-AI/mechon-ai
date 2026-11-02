#!/bin/bash
set -e

echo "=== Mechon AI Workstation Setup (Rust + TypeScript) ==="
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "1. Checking Rust toolchain..."
if ! command -v cargo >/dev/null 2>&1; then
    echo "Error: Cargo is not installed. Please install Rust via https://rustup.rs/." >&2
    exit 1
fi
echo "   Rust version: $(rustc --version)"
echo "   Cargo version: $(cargo --version)"

echo "2. Setting up Frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   Frontend dependencies already installed."
fi

echo "3. Verifying Tauri dependencies..."
cd "$PROJECT_ROOT/src-tauri"
cargo check

echo "=== Setup Complete! ==="
echo "Python is NOT required by Mechon AI."
echo "Run './scripts/dev.sh' or 'cargo test --test core_tests' to verify."
