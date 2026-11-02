# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Model & Boundary

**Mechon AI** is built on an offline-first, local-loopback security model:
1. **Loopback Only**: The internal Python FastAPI server binds strictly to `127.0.0.1`. It does not accept remote network connections.
2. **Local Storage**: User datasets, API keys, and configurations are stored solely on the local filesystem according to XDG standards.
3. **Zero Telemetry**: No user data, prompts, completions, or metrics are transmitted to any external server.

## Reporting a Vulnerability

If you discover a security vulnerability or boundary breach within Mechon AI:

1. **Do not open a public issue.**
2. Send an advisory email with reproduction details to **security@mechon.ai** or use GitHub's private vulnerability reporting feature on the repository.
3. We will acknowledge receipt within 48 hours and work with you to analyze and resolve the issue before public disclosure.
