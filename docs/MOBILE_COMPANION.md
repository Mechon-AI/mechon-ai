# Mechon AI Android Companion & Local Gateway Protocol
**Target Release: Mechon AI v1.2.4**

---

## 1. Overview & Architecture

Mechon AI v1.2.4 introduces the **Mechon AI Android Companion** (`ai.mechon.companion`), a native mobile application designed for conversational AI, roleplay exploration, and mobile-to-workstation dataset generation.

```
+--------------------------------------------------------+
|             Mechon AI Android Companion                |
|  - Jetpack Compose + Material 3 UI                     |
|  - Room Local Persistence (Conversations, Presets)     |
|  - Roleplay Studio (9 Modular Prompt Sections)         |
|  - Vision Model Support & Web Search Grounding         |
|  - One-Tap "Send to Mechon Desktop" Sync               |
+---------------------------+----------------------------+
                            |
           Encrypted Bearer Authentication (SHA-256)
           Local Network (Wi-Fi / LAN)
                            |
+---------------------------v----------------------------+
|             Mechon AI Desktop Gateway                  |
|  - Native Axum HTTP Server (Port 38475)                |
|  - Dynamic LAN IP Detection & QR Pairing Service       |
|  - Secure Provider Model Discovery Proxy               |
|  - Direct Single-Inference Route (No Tri-Agent Leak)   |
|  - Conversation Staging & SFT Dataset Commit Pipeline  |
+--------------------------------------------------------+
```

---

## 2. Desktop Gateway REST API Specification

The desktop workstation runs an embedded Axum HTTP server on port `38475` (default). All endpoints under `/api/v1/` require an `Authorization: Bearer <token>` header, except `/api/v1/ping`, `/api/v1/status`, and `/api/v1/pair`.

### 2.1 Health & Pairing Endpoints

#### `GET /api/v1/ping`
- **Auth**: None
- **Response**: `{"status": "ok", "app": "mechon-ai", "version": "1.2.4"}`

#### `GET /api/v1/status`
- **Auth**: None
- **Response**:
```json
{
  "is_running": true,
  "lan_ip": "192.168.1.100",
  "port": 38475,
  "endpoint": "http://192.168.1.100:38475",
  "version": "1.2.4",
  "connected_devices_count": 1
}
```

#### `POST /api/v1/pair`
- **Auth**: None
- **Body**:
```json
{
  "device_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "device_name": "Google Pixel 8",
  "device_type": "android",
  "pairing_key": "MCH-8A2F-9C14"
}
```
- **Response**:
```json
{
  "success": true,
  "token": "mch_live_xxxxxxxxxxxxxxxx",
  "device_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "desktop_name": "Mechon Workstation",
  "version": "1.2.4"
}
```

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
- **Response**:
```json
{
  "role": "assistant",
  "content": "The Shattered Spire of Aethelgard looms through perpetual cloud-seas...",
  "provider_id": "google",
  "model_id": "gemini-2.5-flash",
  "search_results": null,
  "prompt_tokens": 128,
  "completion_tokens": 420,
  "latency_ms": 612
}
```

---

### 2.3 Mobile-to-Desktop Sync & SFT Pipeline

#### `POST /api/v1/sync/conversations`
- **Auth**: Bearer token
- **Body**:
```json
{
  "idempotency_key": "SYNC-40e1b6f0-d3e9-4e76-8806-03a15c329b3a",
  "conversations": [
    {
      "mobile_session_id": "session-1234",
      "title": "Aethelgard Cartography Exploration",
      "system_prompt": "You are Elena Vance, Arcane Cartographer...",
      "tags": ["roleplay", "mobile-chat", "fantasy"],
      "messages": [
        { "role": "user", "content": "Where are we?", "timestamp": "2026-11-04T10:00:00Z" },
        { "role": "assistant", "content": "Inside the clockwork observatory.", "timestamp": "2026-11-04T10:00:05Z" }
      ],
      "created_at": "2026-11-04T09:58:00Z",
      "updated_at": "2026-11-04T10:05:00Z"
    }
  ]
}
```
- **Response**:
```json
{
  "success": true,
  "transfer_id": "xfer-7b8c9d0e",
  "received_count": 1,
  "message": "Successfully imported 1 conversation(s) into mobile staging queue."
}
```

---

## 3. Roleplay Studio: 9 Modular Prompt Sections

The Android companion includes a structured prompt architect composed of nine modular sections:

1. **Character Identity**: Name, archetype, age, core identity and role.
2. **Appearance & Physicality**: Clothing, physical features, sensory details.
3. **Personality & Psychology**: Traits, flaws, motivations, quirks.
4. **Speech & Voice**: Tone, vocabulary, catchphrases, pacing.
5. **World Setting & Lore**: Universe rules, era, technology/magic, environment.
6. **Scenario & Context**: Opening scene, immediate dilemma, stakes.
7. **User Persona**: User name, role, relationship to character.
8. **Interaction Rules & Guardrails**: POV, forbidden tropes, format rules.
9. **Custom Directives**: Raw system prompt overrides.

Presets can be created, saved, deleted, and activated with one tap to start new chat sessions.

---

## 4. Android Build & CI Instructions

To build the companion app locally:

```bash
cd android
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

Output APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`
