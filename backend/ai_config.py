"""
AI Configuration Manager for LearnOS
Handles runtime LLM configuration from the UI.
Stores config in a JSON file, keys are masked in API responses.
"""

import os
import json
from typing import Optional, Dict, List
from pydantic import BaseModel, Field

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "ai_config.json")

AVAILABLE_PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "models": ["gpt-4o-mini", "gpt-4o", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
        "default_model": "gpt-4o-mini",
        "env_key": "OPENAI_API_KEY",
        "key_prefix": "sk-",
        "docs_url": "https://platform.openai.com/api-keys",
    },
    "anthropic": {
        "name": "Anthropic",
        "models": ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
        "default_model": "claude-sonnet-4-20250514",
        "env_key": "ANTHROPIC_API_KEY",
        "key_prefix": "sk-ant-",
        "docs_url": "https://console.anthropic.com/settings/keys",
    },
    "groq": {
        "name": "Groq",
        "models": ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
        "default_model": "llama-3.1-70b-versatile",
        "env_key": "GROQ_API_KEY",
        "key_prefix": "gsk_",
        "docs_url": "https://console.groq.com/keys",
    },
    "ollama": {
        "name": "Ollama (Local)",
        "models": ["llama3.1", "mistral", "codellama", "phi3"],
        "default_model": "llama3.1",
        "env_key": "",
        "key_prefix": "",
        "docs_url": "https://ollama.ai",
    },
}


class AIConfigRequest(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


class AIConfigStatusResponse(BaseModel):
    provider: str
    model: str
    api_key_set: bool
    api_key_masked: str
    base_url: Optional[str]
    available_providers: List[Dict]
    available_models: List[str]
    mock_mode: bool


class AIConfigManager:
    """Manages AI configuration at runtime."""

    def __init__(self):
        self._config = self._load()

    def _load(self) -> dict:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        return {
            "provider": "openai",
            "api_key": os.getenv("OPENAI_API_KEY", ""),
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "base_url": None,
        }

    def _save(self):
        os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(CONFIG_FILE, "w") as f:
            json.dump(self._config, f, indent=2)

    def get_api_key(self) -> str:
        return self._config.get("api_key", "")

    def get_model(self) -> str:
        return self._config.get("model", "gpt-4o-mini")

    def get_provider(self) -> str:
        return self._config.get("provider", "openai")

    def get_base_url(self) -> Optional[str]:
        return self._config.get("base_url")

    def is_mock_mode(self) -> bool:
        provider = self.get_provider()
        if provider == "ollama":
            return False
        return not bool(self.get_api_key())

    def _mask_key(self, key: str) -> str:
        if not key:
            return ""
        if len(key) <= 8:
            return "****"
        return key[:4] + "•" * (len(key) - 8) + key[-4:]

    def get_status(self) -> AIConfigStatusResponse:
        key = self.get_api_key()
        provider = self.get_provider()
        provider_info = AVAILABLE_PROVIDERS.get(provider, AVAILABLE_PROVIDERS["openai"])
        return AIConfigStatusResponse(
            provider=provider,
            model=self.get_model(),
            api_key_set=bool(key),
            api_key_masked=self._mask_key(key),
            base_url=self.get_base_url(),
            available_providers=[
                {"id": k, "name": v["name"], "docs_url": v["docs_url"]}
                for k, v in AVAILABLE_PROVIDERS.items()
            ],
            available_models=provider_info["models"],
            mock_mode=self.is_mock_mode(),
        )

    def update(self, req: AIConfigRequest) -> AIConfigStatusResponse:
        if req.provider is not None:
            self._config["provider"] = req.provider
            # Reset model to default for new provider
            provider_info = AVAILABLE_PROVIDERS.get(req.provider, {})
            if req.model is None and provider_info:
                self._config["model"] = provider_info.get("default_model", self._config.get("model"))
        if req.api_key is not None:
            self._config["api_key"] = req.api_key
        if req.model is not None:
            self._config["model"] = req.model
        if req.base_url is not None:
            self._config["base_url"] = req.base_url
        self._save()
        # Update env vars for current process
        provider = self.get_provider()
        env_key = AVAILABLE_PROVIDERS.get(provider, {}).get("env_key", "OPENAI_API_KEY")
        if env_key:
            os.environ[env_key] = self._config.get("api_key", "")
        return self.get_status()

    async def test_connection(self) -> Dict:
        provider = self.get_provider()
        key = self.get_api_key()

        if provider == "ollama":
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    url = self.get_base_url() or "http://localhost:11434"
                    r = await client.get(f"{url}/api/tags", timeout=5)
                    return {"success": r.status_code == 200, "models": r.json().get("models", [])}
            except Exception as e:
                return {"success": False, "error": str(e)}

        if not key:
            return {"success": False, "error": "No API key configured"}

        try:
            if provider == "openai":
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=key)
                resp = await client.chat.completions.create(
                    model=self.get_model(),
                    messages=[{"role": "user", "content": "Say 'ok'"}],
                    max_tokens=5,
                )
                return {"success": True, "response": resp.choices[0].message.content.strip()}
            elif provider == "anthropic":
                import httpx
                async with httpx.AsyncClient() as client:
                    r = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                        json={"model": self.get_model(), "max_tokens": 5, "messages": [{"role": "user", "content": "Say ok"}]},
                        timeout=10,
                    )
                    if r.status_code == 200:
                        return {"success": True, "response": r.json()["content"][0]["text"]}
                    return {"success": False, "error": r.text}
            elif provider == "groq":
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
                resp = await client.chat.completions.create(
                    model=self.get_model(),
                    messages=[{"role": "user", "content": "Say 'ok'"}],
                    max_tokens=5,
                )
                return {"success": True, "response": resp.choices[0].message.content.strip()}
            else:
                return {"success": False, "error": f"Unsupported provider: {provider}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


ai_config = AIConfigManager()
