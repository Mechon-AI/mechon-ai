# Mechon AI Android Companion (`ai.mechon.companion`)
**Target Release: v1.2.4 (Build 124)**

Native Android conversational client and dataset engineering companion for Mechon AI.

## Highlights
- **Material 3 & Jetpack Compose**: Fluid dark-themed UI matching Mechon desktop.
- **Local Room Storage**: High-performance local caching of conversations, messages, and roleplay presets.
- **Secure LAN Gateway Pairing**: Dynamic QR code pairing with rotating 15-minute codes and SHA-256 tokens.
- **Roleplay Studio**: 9 modular prompt sections with live preview and preset management.
- **Vision & Attachments**: Attach photos, documents, and code files with automatic base64 streaming.
- **Desktop SFT Staging**: Send selected chats to the Mechon Desktop workstation with idempotency.

## Local Build Instructions
```bash
# Verify unit tests
./gradlew testDebugUnitTest

# Assemble debug APK
./gradlew assembleDebug
```
