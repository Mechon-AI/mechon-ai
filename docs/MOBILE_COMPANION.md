# Mechon AI Android Companion & Local Gateway Protocol
**Target Release: Mechon AI v1.2.5**

---

## 1. Overview & Architecture

Mechon AI v1.2.5 provides the **Mechon AI Android Companion** (`ai.mechon.companion`), a native mobile AI chat client designed for conversational immersion, structured roleplay, and mobile-to-workstation SFT dataset engineering.

```
+-------------------------------------------------------------+
|               Mechon AI Android Companion                   |
|  - Jetpack Compose + Material 3 Conversational UI           |
|  - Opens directly into Chat (Drawer for conversation lib)   |
|  - Message Controls: Copy, Edit, Regenerate, Delete, Stop   |
|  - Expandable Composer: Vision attachments, Web Search      |
|  - Advanced Roleplay Studio: 10 Modular Sections + Custom   |
|  - Character Library with avatars, presets & prompt history |
|  - Automatic LAN Discovery & Approval-Based Pairing         |
|  - 16 KB Page-Size Compatible (Pure JVM QR / Zero JNI .so)  |
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
|  - Provider Model Discovery Proxy                           |
|  - Direct Single-Inference Route (No Tri-Agent Leak)        |
|  - Staging Queue & Commit to Mechon SFT Corpus              |
+-------------------------------------------------------------+
```

---

## 2. Desktop Gateway REST API Specification

The desktop workstation runs an embedded Axum HTTP server on port `38475`.

### 2.1 Health & Discovery Endpoints

#### `GET /api/v1/ping`
- **Auth**: None
- **Response**: `{"status": "ok", "app": "mechon-ai", "version": "1.2.5"}`

#### `GET /api/v1/status`
- **Auth**: None
- **Response**:
```json
{
  "status": "online",
  "version": "1.2.5",
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
  "version": "1.2.5"
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
      "provider_id": "google",
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
  "default_model": "gemini-2.5-flash",
  "default_provider": "google"
}
```

#### `POST /api/v1/inference/chat`
- **Auth**: Bearer token
- **Body**:
```json
{
  "model_id": "gemini-2.5-flash",
  "provider_id": "google",
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

## 3. Roleplay Studio: 10 Modular Prompt Sections

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

## 4. 16 KB Memory Page Size Compatibility

To ensure compatibility with Android 15+ 16 KB memory page sizes:
- Replaced legacy C++ JNI barcode scanning (`libbarhopper_v3.so`, `libimage_processing_util_jni.so`) with pure JVM ZXing byte-code.
- Configured Android Gradle Plugin packaging with `jniLibs { useLegacyPackaging = false }` to ensure all native libraries are 16 KB page aligned uncompressed in the APK.

---

## 5. Local Build Instructions

```bash
cd android
./gradlew testDebugUnitTest
./gradlew assembleDebug
```
Output APK is located at `android/app/build/outputs/apk/debug/app-debug.apk`.
