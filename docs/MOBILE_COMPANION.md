# Mechon AI Android Companion & Local Gateway Protocol
**Target Release: Mechon AI v1.2.6**

---

## 1. Overview & Architecture

Mechon AI v1.2.6 provides the **Mechon AI Android Companion** (`ai.mechon.companion`), a native mobile AI chat client designed for conversational immersion, structured roleplay, and mobile-to-workstation SFT dataset engineering.

### Remote Provider Ownership & Inference Pipeline
When paired with the Mechon AI Desktop Workstation:
- **Desktop owns the Provider Registry & Credentials**: Android does not evaluate, register, or authenticate providers locally.
- **Desktop owns Model Discovery**: `/api/v1/providers/models` returns canonical providers and discovered models.
- **Desktop owns Inference Routing**: `/api/v1/inference/chat` resolves provider aliases (`google` -> `gemini`, `claude` -> `anthropic`, `chatgpt` -> `openai`, `local` -> `ollama`) and queries credentials securely from the desktop vault.
- **Android acts as a Remote Client**: Conversations select discovered models through a searchable Material 3 model selector dialog with visual availability indicators, vision support badges, and context window lengths.

```
+-------------------------------------------------------------+
|               Mechon AI Android Companion                   |
|  - Jetpack Compose + Material 3 Conversational UI           |
|  - Searchable Model & Provider Selector Dialog              |
|  - Strict Connection Lifecycle (LAN Discovery & Approval)   |
|  - Message Controls: Copy, Edit, Regenerate, Delete, Stop   |
|  - Expandable Composer: Vision attachments, Web Search      |
|  - Advanced Roleplay Studio: 10 Modular Sections + Custom   |
|  - Character Library with avatars, presets & prompt history |
|  - 16 KB Page-Size Compatible (Pure JVM / Zero JNI .so)     |
|  - Persistent v1/v2/v3 Signing (Zero signature conflicts)   |
+------------------------------+------------------------------+
                               |
              Encrypted Bearer Authentication (SHA-256)
              Local Network Discovery (UDP Port 38476)
              Authenticated Gateway (TCP Port 38475)
                               |
+------------------------------v------------------------------+
|                Mechon AI Desktop Gateway                    |
|  - Native Axum HTTP Server (Port 38475)                     |
|  - UDP Auto-Discovery Beacon & LAN Responder (Port 38476)   |
|  - Real-Time Approval-Based Device Pairing Workflow         |
|  - Canonical Provider Model Registry & Alias Resolution     |
|  - Direct Single-Inference Route (Desktop Vault Powered)    |
|  - Staging Queue & Commit to Mechon SFT Corpus              |
+-------------------------------------------------------------+
```

---

## 2. Desktop Gateway REST API Specification

The desktop workstation runs an embedded Axum HTTP server on port `38475`.

### 2.1 Health & Discovery Endpoints

#### `GET /api/v1/ping`
- **Auth**: None
- **Response**: `{"status": "ok", "app": "mechon-ai", "version": "1.2.6"}`

#### `GET /api/v1/status`
- **Auth**: None
- **Response**:
```json
{
  "status": "online",
  "version": "1.2.6",
  "local_ip": "192.168.1.100",
  "port": 38475,
  "workstation_name": "Mechon AI Workstation"
}
```

#### `POST /api/v1/pairing/request`
- **Auth**: None
- **Body**:
```json
{
  "device_id": "uuid-here",
  "device_name": "Pixel 9 Pro",
  "device_platform": "android",
  "client_nonce": "1730700000000"
}
```
- **Response**:
```json
{
  "request_id": "req-9b1deb4d",
  "status": "pending",
  "message": "Connection request submitted. Awaiting approval on Mechon Desktop."
}
```

#### `GET /api/v1/pairing/status/{request_id}`
- **Auth**: None
- **Response (Approved)**:
```json
{
  "request_id": "req-9b1deb4d",
  "status": "approved",
  "token": "mch_live_xxxxxxxxxxxxxxxx",
  "device_id": "uuid-here",
  "desktop_name": "Mechon Workstation",
  "version": "1.2.6"
}
```

#### `POST /api/v1/pair` (Legacy QR Fallback)
- **Auth**: None
- Validates 15-minute rotating pairing key (`MCH-XXXX-YYYY`).

---

### 2.2 Model Discovery & Inference Endpoints

#### `GET /api/v1/providers/models`
- **Auth**: Bearer token
- **Response**:
```json
{
  "models": [
    {
      "provider_id": "gemini",
      "provider_name": "Google Gemini",
      "model_id": "gemini-2.5-flash",
      "supports_vision": true
    },
    {
      "provider_id": "groq",
      "provider_name": "Groq",
      "model_id": "llama-3.3-70b-versatile",
      "supports_vision": false
    }
  ],
  "providers": [
    {
      "id": "gemini",
      "name": "Google Gemini",
      "configured": true,
      "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
    }
  ],
  "default_model": "gemini-2.5-flash",
  "default_provider": "gemini"
}
```

#### `POST /api/v1/inference/chat`
- **Auth**: Bearer token
- **Body**:
```json
{
  "model_id": "gemini-2.5-flash",
  "provider_id": "gemini",
  "messages": [
    {
      "role": "user",
      "content": "Describe the ruins of Aethelgard.",
      "attachments": []
    }
  ],
  "system_prompt": "# SYSTEM INSTRUCTION...",
  "temperature": 0.7,
  "max_tokens": 2048,
  "web_search_enabled": false
}
```

---

### 2.3 Mobile-to-Desktop Sync & SFT Pipeline

#### `POST /api/v1/sync/conversations`
- **Auth**: Bearer token
- **Idempotency**: Requests with identical `idempotency_key` are acknowledged without creating duplicate records.
- **Payload**: Contains conversation metadata, model IDs, system prompt snapshots, and ordered turns.

---

## 3. Searchable Model & Provider Selector

The companion chat screen features an interactive model picker in the top bar:
- Search bar with instant client-side filtering across model names, model IDs, and provider names.
- Filter chips to filter by provider (e.g., All, Google Gemini, Anthropic, OpenAI, Groq, Ollama).
- Context window and vision support chips (`Vision`, `1M context`, `128K context`).
- Visual indicator dots showing model availability status.
- Desktop connection status icon in the app bar linking directly to pairing status.
- Zero-crash fallback: Safe deserialization handling both legacy `{ providers: [...] }` and canonical `{ models: [...], providers: [...] }` desktop payloads.

---

## 4. Connection Lifecycle States

The Companion adheres to an explicit connection state machine:
- `DISCONNECTED`: Not connected to any desktop workstation.
- `DISCOVERING`: Scanning local network UDP broadcast beacons (Port 38476).
- `PAIRING_REQUESTED`: Sent connection request to desktop workstation.
- `AWAITING_APPROVAL`: Polling approval status while user approves prompt on desktop.
- `CONNECTED`: Successfully authenticated with SHA-256 bearer token.
- `RECONNECTING`: Attempting reconnection after transient network drop.
- `CONNECTION_LOST`: Reconnection attempts timed out.
- `ERROR`: Network or pairing error.

---

## 5. Roleplay Studio: 10 Modular Prompt Sections

The Android companion includes an advanced prompt architect with ten modular sections:

1. **Character Identity**: Name, archetype, age, core identity and role.
2. **Appearance**: Clothing, physical features, sensory details.
3. **Personality**: Traits, flaws, motivations, quirks.
4. **Character Voice**: Tone, vocabulary, catchphrases, pacing.
5. **World Building**: Universe rules, era, technology/magic, environment.
6. **Scenario**: Opening scene, immediate dilemma, stakes.
7. **User Persona**: User name, role, relationship to character.
8. **Interaction Rules**: POV, formatting, forbidden tropes.
9. **Narrative Style**: Prose atmosphere, sensory descriptions.
10. **Additional Instructions**: Custom system overrides.

Plus **Dynamic Custom Sections**: Users can add unlimited custom sections with personalized headers.

### Character Library
- Create, duplicate, edit, and delete characters with custom avatars (emojis/icons) and descriptions.
- Each conversation preserves its original system prompt snapshot, guaranteeing reproducible dataset provenance.

---

## 6. 16 KB Memory Page Size Compatibility

To ensure full compatibility with Android 15+ 16 KB memory page sizes:
- Zero unaligned C++ native libraries in packaging (`unzip -l *.apk | grep '\.so'` returns zero entries).
- Pure JVM ZXing barcode generation for pairing.
- Configured Android Gradle Plugin packaging with `jniLibs { useLegacyPackaging = false }` so that any future native shared libraries are strictly 16 KB page-aligned.

---

## 7. Persistent Release Signing & Update Compatibility

To resolve `INSTALL_FAILED_UPDATE_INCOMPATIBLE` during upgrades:
- Configured persistent signing configuration in `android/app/build.gradle.kts` supporting APK Signature Scheme v1, v2, and v3.
- Both debug and release builds use consistent signing identities, allowing seamless over-the-top updates without requiring `adb uninstall`.

---

## 8. Local Build & Test Instructions

```bash
cd android

# Run Android Companion unit tests
./gradlew testDebugUnitTest

# Build debug APK
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Build signed release APK
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Verify 16 KB compliance (should output 0 .so files)
unzip -l app/build/outputs/apk/release/app-release.apk | grep '\.so'
```
