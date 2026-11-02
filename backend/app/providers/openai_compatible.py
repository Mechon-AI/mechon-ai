"""
OpenAI-compatible Provider implementation.
Works with OpenAI, local vLLM, LM Studio, SGLang, LiteLLM, and Ollama /v1.
Supports full streaming using SSE decoding.
"""

import json
from typing import List, Dict, Any, AsyncGenerator, Optional
import httpx
from app.providers.base import BaseProvider


class OpenAICompatibleProvider(BaseProvider):
    def __init__(self, name: str, base_url: str, api_key: Optional[str] = None, timeout: int = 60, settings: Optional[Dict[str, Any]] = None):
        super().__init__(name, base_url.rstrip("/"), api_key, timeout, settings)
        self.headers = {"Content-Type": "application/json"}
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"

    async def list_models(self) -> List[str]:
        url = f"{self.base_url}/models"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    return models
        except Exception:
            pass
        return []

    async def health_check(self) -> bool:
        url = f"{self.base_url}/models"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=self.headers)
                return resp.status_code == 200
        except Exception:
            return False

    def _prepare_payload(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
        stream: bool = False
    ) -> Dict[str, Any]:
        formatted_msgs = []
        if system_prompt:
            formatted_msgs.append({"role": "system", "content": system_prompt})
        formatted_msgs.extend([
            {"role": m["role"], "content": m["content"]}
            for m in messages if m.get("content")
        ])
        
        return {
            "model": model or "default",
            "messages": formatted_msgs,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": stream
        }

    async def generate(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        target_model = model or "default"
        payload = self._prepare_payload(messages, system_prompt, target_model, temperature, top_p, max_tokens, stream=False)
        
        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                resp = await client.post(url, headers=self.headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                choice = data["choices"][0]
                content = choice["message"]["content"]
                usage = data.get("usage", {})
                tokens = usage.get("total_tokens", len(content.split()))
                return {
                    "content": content,
                    "tokens": tokens,
                    "model": data.get("model", target_model)
                }
        except httpx.ConnectError:
            raise RuntimeError(f"Could not connect to provider at {self.base_url}. Please ensure the server is active.")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Provider returned error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise RuntimeError(f"Inference error: {str(e)}")

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/chat/completions"
        payload = self._prepare_payload(messages, system_prompt, model, temperature, top_p, max_tokens, stream=True)
        
        async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
            async with client.stream("POST", url, headers=self.headers, json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(data_str)
                            delta = chunk_data["choices"][0].get("delta", {})
                            chunk = delta.get("content", "")
                            if chunk:
                                yield chunk
                        except Exception:
                            continue
