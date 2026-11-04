# Mechon AI Android Companion (`ai.mechon.companion`)
**Target Release: v1.2.8 (Build 128)**

Native Android conversational AI client, structured roleplay studio, and dataset engineering companion for Mechon AI.

## Highlights
- **Chat-First Conversational UI**: Opens directly into multi-turn dialogue with sliding conversation navigation drawer.
- **Message Action Controls**: Copy, edit, regenerate, delete, and stop in-flight generation.
- **Advanced Roleplay Studio**: 10 modular sections + dynamic custom section creator + Character Library.
- **Automatic LAN Discovery & Approval Pairing**: Zero-configuration mDNS/UDP discovery on port 38476 with real-time desktop approval handshake.
- **Vision & Web Search**: Attach images and documents with vision model validation; toggle web search grounding with source citations.
- **16 KB Page-Size Ready**: 100% compliant with Android 15+ 16 KB memory page sizes (pure JVM ZXing byte-code, zero unaligned `.so` libraries).
- **Desktop SFT Pipeline**: One-tap multi-session transfer to Mechon Desktop for fine-tuning curation.

## Local Build & Test
```bash
./gradlew testDebugUnitTest
./gradlew assembleDebug
```
