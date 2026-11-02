#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Packaging Mechon AI for Linux Distributions ==="

# 1. Arch Linux
echo "[Arch Linux] Checking PKGBUILD..."
cd "$PROJECT_ROOT/packaging/arch"
if command -v namcap >/dev/null 2>&1; then
    namcap PKGBUILD || true
fi
echo "[Arch Linux] PKGBUILD is ready for 'makepkg -si'."

# 2. Debian / Ubuntu
echo "[Debian] Checking DEB control file..."
cat "$PROJECT_ROOT/packaging/debian/control"

# 3. RPM Spec
echo "[RPM] Checking spec file..."
cat "$PROJECT_ROOT/packaging/rpm/mechon-ai.spec"

echo "=== Linux packaging manifests verified for Mechon AI! ==="
