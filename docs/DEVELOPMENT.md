# Development & Contributing Guide
**Version 1.2.8 | Mechon AI Fine-Tuning Workstation**

This guide provides setup, development, testing, and build instructions for contributors working on Mechon AI.

---

## 1. Prerequisites

### Desktop Environment (Rust + Tauri + React)
- **Rust**: 1.77+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Node.js**: 18+ or 20+ with `npm`
- **Linux System Libraries** (Arch Linux):
  ```bash
  sudo pacman -S --needed base-devel cairo gdk-pixbuf2 glib2 gtk3 openssl pango sqlite webkit2gtk-4.1 pkgconf
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Android Environment (Kotlin + Compose)
- **JDK**: OpenJDK 17 or 21
- **Android SDK**: API Level 34+ (Android 14/15)
- **Build Tools**: 34.0.0+

---

## 2. Repository Layout

```
mechon-ai/
├── src-tauri/                  # Native Rust Backend & Tauri 2 Integration
│   ├── src/                    # Axum gateway, provider drivers, SQLite WAL migrations
│   ├── tests/                  # Gateway, authentication & SFT pipeline integration tests
│   └── Cargo.toml              # Rust crate manifest (v1.2.8)
├── frontend/                   # Frontend Workstation Shell
│   ├── src/                    # React 18 + TypeScript + Vite 6
│   │   ├── features/           # SFT Studio, Story Architect, Corpus, DPO, Forge, Mobile
│   │   ├── stores/             # Zustand state management
│   │   └── services/           # Tauri IPC & Axum API clients
│   └── package.json            # Node dependencies & build scripts
├── android/                    # Android Companion App (ai.mechon.companion)
│   ├── app/src/main/           # Kotlin, Jetpack Compose, Material 3, OkHttp
│   └── app/src/test/           # Mobile unit & connectivity regression tests
├── packaging/                  # Distro packaging scripts (Arch Linux PKGBUILD)
└── docs/                       # Technical & product documentation
```

---

## 3. Running the Desktop Application

### Run in Development Mode
```bash
# Install frontend dependencies
cd frontend && npm install

# Launch Tauri development environment (hot-reloading frontend + recompiling Rust)
cd ..
npm run tauri dev
```

### Run Frontend in Browser (Mock Mode)
```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

---

## 4. Testing Suites

### Rust Test Suite
```bash
cd src-tauri
cargo test
# Run specific mobile gateway integration tests:
cargo test --test mobile_companion_gateway_tests
```

### Android Test Suite & APK Assembly
```bash
cd android
# Run unit & connectivity regression tests:
./gradlew testDebugUnitTest

# Assemble debug and release APKs:
./gradlew assembleDebug assembleRelease
```

---

## 5. Building Production Packages

### Desktop AppImage / Deb / Arch Package
```bash
npm run tauri build
```

To build the Arch Linux native package using `makepkg`:
```bash
cd packaging/arch
makepkg -s
```
