"""
Native Ollama Provider implementation.
Directly interfaces with Ollama's /api/chat and /api/tags endpoints.
"""

import json
from typing import List, Dict, Any, AsyncGenerator, Optional
import httpx
from app.providers.base import BaseProvider


class OllamaProvider(BaseProvider):
    def __init__(self, name: str, base_url: str = "http://127.0.0.1:11434", api_key: Optional[str] = None, timeout: int = 60, settings: Optional[Dict[str, Any]] = None):
        super().__init__(name, base_url.rstrip("/"), api_key, timeout, settings)

    async def list_models(self) -> List[str]:
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                    return models
        except Exception:
            pass
        return []

    async def health_check(self) -> bool:
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                return resp.status_code == 200
        except Exception:
            return False

    async def generate(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/api/chat"
        formatted_msgs = []
        if system_prompt:
            formatted_msgs.append({"role": "system", "content": system_prompt})
        formatted_msgs.extend([{"role": m["role"], "content": m["content"]} for m in messages if m.get("content")])

        target_model = model or "llama3:latest"
        payload = {
            "model": target_model,
            "messages": formatted_msgs,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": max_tokens
            }
        }

        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data.get("message", {}).get("content", "")
                return {
                    "content": content,
                    "tokens": data.get("eval_count", len(content.split())),
                    "model": data.get("model", target_model)
                }
        except httpx.ConnectError:
            raise RuntimeError(f"Could not connect to Ollama at {self.base_url}. Please ensure Ollama is running.")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama server returned error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise RuntimeError(f"Ollama inference error: {str(e)}")

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/api/chat"
        formatted_msgs = []
        if system_prompt:
            formatted_msgs.append({"role": "system", "content": system_prompt})
        formatted_msgs.extend([{"role": m["role"], "content": m["content"]} for m in messages if m.get("content")])

        payload = {
            "model": model or "llama3:latest",
            "messages": formatted_msgs,
            "stream": True,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": max_tokens
            }
        }

        async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
            async with client.stream("POST", url, json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk_obj = json.loads(line)
                        chunk = chunk_obj.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                    except Exception:
                        continue
