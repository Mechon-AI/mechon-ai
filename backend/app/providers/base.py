"""
Base Provider Interface.
All model providers must implement this interface to support unified inference.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, AsyncGenerator, Optional


class BaseProvider(ABC):
    def __init__(self, name: str, base_url: str, api_key: Optional[str] = None, timeout: int = 60, settings: Optional[Dict[str, Any]] = None):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.settings = settings or {}

    @abstractmethod
    async def list_models(self) -> List[str]:
        """Fetch available models from the provider."""
        pass

    @abstractmethod
    async def generate(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        """Generate a complete completion. Returns {'content': str, 'tokens': int, 'model': str}."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """Stream completion text tokens."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider endpoint is responsive and authenticated."""
        pass

    def get_provider_info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "base_url": self.base_url,
            "timeout": self.timeout,
            "type": self.__class__.__name__
        }
