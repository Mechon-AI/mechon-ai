#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Starting Mechon AI Workstation (Dev Mode) ==="

# Trap cleanup
cleanup() {
    echo ""
    echo "[Dev] Stopping development processes..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start Vite dev server in background
echo "[Dev] Starting Vite development server on http://localhost:5173..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
VITE_PID=$!

# Wait for Vite dev server to respond
echo "[Dev] Waiting for Vite development server..."
for i in {1..20}; do
    if curl -s http://localhost:5173 >/dev/null 2>&1; then
        echo "[Dev] Vite dev server ready!"
        break
    fi
    sleep 0.5
done

# Launch Tauri native core
echo "[Dev] Launching Tauri desktop application..."
cd "$PROJECT_ROOT/src-tauri"
cargo run
