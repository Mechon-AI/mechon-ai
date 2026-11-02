"""
Provider Manager factory.
Maintains instances of active model providers and routes inference requests.
"""

from typing import Dict, Optional, Any
from app.providers.base import BaseProvider
from app.providers.mock_provider import MockProvider
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.ollama import OllamaProvider


class ProviderManager:
    _instance: Optional["ProviderManager"] = None

    def __init__(self):
        self._cache: Dict[str, BaseProvider] = {}
        # Built-in default mock provider
        self._mock = MockProvider()
        self._cache["mock"] = self._mock

    @classmethod
    def get_instance(cls) -> "ProviderManager":
        if cls._instance is None:
            cls._instance = ProviderManager()
        return cls._instance

    def get_provider(self, provider_id: Optional[str], provider_record: Optional[Any] = None) -> BaseProvider:
        """Get or instantiate provider adapter."""
        if not provider_id or provider_id == "mock":
            return self._mock

        if provider_id in self._cache:
            return self._cache[provider_id]

        if provider_record:
            ptype = provider_record.provider_type
            if ptype == "mock":
                adapter = MockProvider(
                    name=provider_record.name,
                    base_url=provider_record.base_url,
                    timeout=provider_record.timeout_seconds
                )
            elif ptype == "ollama":
                adapter = OllamaProvider(
                    name=provider_record.name,
                    base_url=provider_record.base_url,
                    timeout=provider_record.timeout_seconds
                )
            else:  # openai_compatible, custom_http, vllm, etc.
                adapter = OpenAICompatibleProvider(
                    name=provider_record.name,
                    base_url=provider_record.base_url,
                    api_key=provider_record.api_key_encrypted,
                    timeout=provider_record.timeout_seconds
                )
            self._cache[provider_id] = adapter
            return adapter

        return self._mock

    def invalidate(self, provider_id: str):
        if provider_id in self._cache and provider_id != "mock":
            del self._cache[provider_id]


provider_manager = ProviderManager.get_instance()
