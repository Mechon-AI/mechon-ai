# Model Providers & Credential Vault
**Version 1.2.8 | Mechon AI Fine-Tuning Workstation**

Mechon AI provides a unified, vendor-agnostic inference layer supporting both local offline runtimes and major cloud AI platforms. All providers share a standardized interface for chat completions, streaming, token counting, and model parameter tuning.

---

## 1. Supported Providers

| Provider | Type | Default Models | Key Capabilities |
|---|---|---|---|
| **Ollama** | Local / Offline | `llama3.1`, `mistral`, `qwen2.5`, `phi3` | 100% air-gapped, zero-cost, local GPU/CPU execution |
| **Google Gemini** | Cloud API | `gemini-2.5-flash`, `gemini-2.5-pro` | High context window (up to 1M+ tokens), multimodal vision |
| **Anthropic Claude** | Cloud API | `claude-3-5-sonnet`, `claude-3-5-haiku` | Nuanced roleplay, narrative reasoning, code alignment |
| **OpenAI** | Cloud API | `gpt-4o`, `gpt-4o-mini`, `o1-mini` | General conversational alignment, function-calling datasets |
| **Groq** | Cloud LPU | `llama-3.1-8b-instant`, `llama-3.3-70b-versatile` | Ultra-low latency, ideal for Story Architect Planning Agent |
| **Mistral AI** | Cloud API | `mistral-large-latest`, `codestral-latest` | Multilingual European languages, code synthesis |
| **OpenRouter** | API Gateway | Any supported OpenRouter model slug | Access to hundreds of open-weights and proprietary models |
| **Custom / OpenAI-Compatible** | Local / Cloud | User-specified | Support for vLLM, TGI, LM Studio, LocalAI, and self-hosted clusters |

---

## 2. Canonical Provider Alias Normalization

To ensure seamless interoperability between desktop and mobile clients, Mechon AI automatically normalizes incoming provider keys:

| Client Alias | Canonical Provider ID | Notes |
|---|---|---|
| `google`, `gemini-api` | `gemini` | Normalizes to Google Gemini adapter |
| `claude`, `anthropic-ai` | `anthropic` | Normalizes to Anthropic Claude adapter |
| `chatgpt`, `openai-api` | `openai` | Normalizes to OpenAI adapter |
| `local`, `ollama-local` | `ollama` | Normalizes to local Ollama instance |
| `custom`, `vllm`, `lmstudio` | `custom` | OpenAI-compatible custom endpoint |

If a provider is requested that has not yet been saved to the database, Mechon AI auto-provisions default configuration parameters from `ProviderRegistry::global()`.

---

## 3. Secure Credential Vault

Mechon AI enforces strict cryptographic separation of API credentials:
- **Zero Plaintext Storage**: API keys are never written in plaintext to SQLite or config files.
- **Native OS Vault Integration**: On Linux, credentials are encrypted and stored in the **FreeDesktop Secret Service** (GNOME Keyring) or **KDE KWallet** via D-Bus IPC.
- **AES-256-GCM Fallback**: In environments without a running Secret Service daemon, credentials are encrypted with AES-256-GCM using a machine-specific hardware derivative key.
- **Zero Telemetry**: API keys are strictly used for in-process HTTP requests to the respective provider endpoints; they are never transmitted to Mechon servers or third parties.
