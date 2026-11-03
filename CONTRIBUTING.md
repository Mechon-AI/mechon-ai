# Contributing to Mechon AI

Thank you for your interest in contributing to **Mechon AI**!

Mechon AI is built by and for AI researchers, dataset engineers, and developers who demand complete sovereignty, rigor, and speed over language model alignment data.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Architectural Principles

Before contributing code, please keep in mind our core architectural tenets:

1. **100% Native Desktop Architecture**:
   - Zero Python backend runtime or external HTTP servers.
   - All backend logic resides in the Rust Tauri core (`src-tauri/`) and communicates via direct in-process Tauri IPC commands (`tauri::generate_handler!`).

2. **Local-First & Offline Sovereignty**:
   - Mechon AI must remain fully functional offline.
   - Never add mandatory cloud dependencies, remote analytics, or telemetry.
   - Built-in Mock provider must always function out of the box with zero network activity.

3. **Atomic SFT Records**:
   - In Mechon SFT, multi-turn dialogues must always commit as **exactly one atomic record** with a canonical messages array (`messages: [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]`). Never split turns across rows in the core dataset.

4. **Storage & Credential Security**:
   - The database is SQLite with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and foreign keys enforced (`PRAGMA foreign_keys=ON`).
   - Use migrations or safe schema evolution for changes to entities.
   - **Never store API keys in plaintext in SQLite**. Always route credentials through `HybridCredentialVault`.

5. **Standards & Conventions**:
   - Respect XDG Base Directory conventions on Linux (`~/.local/share/mechon-ai`, `~/.config/mechon-ai`).
   - Do not hardcode distro-specific paths.

---

## Development Workflow

### 1. Prerequisites
- **Linux** (Arch Linux or any modern distribution)
- **Rust & Cargo** (1.75+): Install via [rustup.rs](https://rustup.rs/)
- **Node.js** (v18+) & **npm**
- **System packages** (Arch Linux): `sudo pacman -S webkit2gtk-4.1 gtk3 openssl sqlite pkgconf`
- *(Note: Python is NOT required by Mechon AI at runtime or build time)*

### 2. Fork and Clone
```bash
git clone https://github.com/Mechon-AI/mechon-ai.git
cd mechon-ai
```

### 3. Environment Setup
```bash
./scripts/setup.sh
```

### 4. Start Development Environment
```bash
./scripts/dev.sh
```
This launches the Vite development server in the background and starts the native Tauri application with hot-reloading.

### 5. Running the Automated Test Suite
Before opening a pull request, run the test script:
```bash
./scripts/test.sh
```
Or run individual Rust test suites directly:
```bash
cd src-tauri
cargo test
```

### 6. Production Compilation
```bash
./scripts/build.sh
```
The compiled native executable will be located at `src-tauri/target/release/mechon-ai`.

---

## Submitting Pull Requests

- Keep pull requests focused on a single feature or bugfix.
- Follow conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Include unit/integration tests in `src-tauri/tests/` when modifying backend services or Tauri commands.
- Ensure TypeScript compiles cleanly without errors (`npm run build` in `frontend/`).
