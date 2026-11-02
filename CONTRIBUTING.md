# Contributing to Mechon AI

Thank you for your interest in contributing to **Mechon AI**!

Mechon AI is built by and for AI researchers, dataset engineers, and developers who value data quality, local control, and rigorous engineering.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Architectural Principles

Before contributing code, please keep in mind our core architectural tenets:

1. **Local-First & Offline Sovereignty**:
   - Mechon AI must remain fully functional offline.
   - Never add mandatory cloud dependencies, remote analytics, or telemetry.
   - The backend binds strictly to loopback `127.0.0.1`.

2. **Atomic SFT Records**:
   - In Mechon SFT, multi-turn dialogues must always commit as **exactly one atomic record** with a canonical messages array (`[{role, content}, ...]`). Never split turns across rows in the core dataset.

3. **Storage & Data Integrity**:
   - The database is SQLite with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and foreign keys enforced (`PRAGMA foreign_keys=ON`).
   - Use migrations or safe schema evolution for changes to entities.

4. **Standards & Conventions**:
   - Respect XDG Base Directory conventions on Linux (`~/.local/share/mechon-ai`, `~/.config/mechon-ai`).
   - Do not hardcode distro-specific paths.

---

## Development Workflow

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/Mechon-AI/mechon-ai.git
   cd mechon-ai
   ```

2. **Environment Setup**:
   ```bash
   ./scripts/setup.sh
   ```

3. **Start Development Environment**:
   ```bash
   ./scripts/dev.sh
   ```

4. **Run Verification & Tests**:
   Before opening a pull request, ensure all backend and frontend checks pass:
   ```bash
   ./scripts/test.sh
   ```

---

## Submitting Pull Requests

- Keep pull requests focused on a single feature or bugfix.
- Follow conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Include unit/integration tests in `backend/tests/` when modifying backend services or API schemas.
- Ensure TypeScript compiles cleanly without errors (`npm run build` in `frontend/`).
