"""
Mock LLM Provider for testing, local offline development, and verification.
Provides contextual multi-turn conversation responses and dual DPO answers.
"""

import asyncio
from typing import List, Dict, Any, AsyncGenerator, Optional
from app.providers.base import BaseProvider


class MockProvider(BaseProvider):
    def __init__(self, name: str = "Local Mock LLM", base_url: str = "mock://internal", api_key: Optional[str] = None, timeout: int = 30, settings: Optional[Dict[str, Any]] = None):
        super().__init__(name, base_url, api_key, timeout, settings)
        self.models = ["mock-llama-3-8b", "mock-qwen-2.5-7b", "mock-mistral-nemo"]

    async def list_models(self) -> List[str]:
        return self.models

    async def health_check(self) -> bool:
        return True

    def _generate_contextual_response(self, messages: List[Dict[str, str]], prompt_override: Optional[str] = None) -> str:
        last_user = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = m.get("content", "").strip()
                break
        
        if not last_user and prompt_override:
            last_user = prompt_override

        lower = last_user.lower()
        if "gradient descent" in lower:
            if "example" in lower or "numerical" in lower:
                return (
                    "Here is a simple numerical example of Gradient Descent:\n\n"
                    "Consider the objective function $f(w) = w^2$. The derivative is $f'(w) = 2w$.\n"
                    "Suppose our learning rate $\\eta = 0.1$ and initial weight $w_0 = 5.0$:\n\n"
                    "1. **Step 1**:\n"
                    "   - Gradient: $2 \\times 5.0 = 10.0$\n"
                    "   - Update: $w_1 = 5.0 - (0.1 \\times 10.0) = 4.0$\n\n"
                    "2. **Step 2**:\n"
                    "   - Gradient: $2 \\times 4.0 = 8.0$\n"
                    "   - Update: $w_2 = 4.0 - (0.1 \\times 8.0) = 3.2$\n\n"
                    "Notice that with each step, $w$ moves closer to the true minimum $w = 0$."
                )
            return (
                "Gradient descent is a first-order iterative optimization algorithm used in machine learning "
                "to find a local minimum of a differentiable function. The algorithm repeatedly takes steps proportional "
                "to the negative of the gradient of the loss function at the current point:\n\n"
                "$$\\theta_{t+1} = \\theta_t - \\eta \\nabla L(\\theta_t)$$\n\n"
                "where $\\eta$ is the learning rate."
            )
        elif "python" in lower or "code" in lower:
            return (
                "Here is an efficient Python implementation:\n\n"
                "```python\n"
                "def solve_problem(items: list[int]) -> dict[str, int]:\n"
                "    \"\"\"Process items and return aggregated summary.\"\"\"\n"
                "    return {\n"
                "        'total': sum(items),\n"
                "        'count': len(items),\n"
                "        'maximum': max(items) if items else 0\n"
                "    }\n"
                "```\n\n"
                "This runs with $O(N)$ time complexity and minimal memory overhead."
            )
        else:
            turn_count = len(messages)
            return (
                f"Thank you for your message: \"{last_user[:80]}\".\n\n"
                f"As an AI assistant in this conversation (turn #{turn_count}), I have analyzed your query and structured the key points:\n\n"
                "1. **Core Concept**: Understanding your requirement and context.\n"
                "2. **Actionable Solution**: Applying best practices in dataset curation and model alignment.\n"
                "3. **Verification**: Confirming output quality and consistency."
            )

    async def generate(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        await asyncio.sleep(0.05)  # Simulate brief inference
        text = self._generate_contextual_response(messages)
        return {
            "content": text,
            "tokens": len(text.split()),
            "model": model or self.models[0]
        }

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        text = self._generate_contextual_response(messages)
        words = text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield chunk
            await asyncio.sleep(0.01)  # small stream delay
