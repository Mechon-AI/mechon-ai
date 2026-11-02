#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Starting Mechon AI (Dev Mode) ==="

# Trap cleanup to terminate background processes on Ctrl+C
cleanup() {
    echo ""
    echo "[Dev] Stopping backend and frontend..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start backend
echo "[Dev] Starting FastAPI backend on http://127.0.0.1:18420..."
cd "$PROJECT_ROOT/backend"
.venv/bin/python -m app.main --host 127.0.0.1 --port 18420 &
BACKEND_PID=$!

# Wait for backend health
echo "[Dev] Waiting for backend readiness..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:18420/api/health >/dev/null; then
        echo "[Dev] Backend is ready!"
        break
    fi
    sleep 0.5
done

# Start frontend
echo "[Dev] Starting Vite development server on http://localhost:5173..."
cd "$PROJECT_ROOT/frontend"
npm run dev
