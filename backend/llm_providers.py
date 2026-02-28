"""
Multi-LLM Provider Architecture
Supports OpenAI, Anthropic, Groq, and local models via Ollama
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, AsyncGenerator
from pydantic import BaseModel, Field
from enum import Enum
import httpx
import json
from datetime import datetime
import os

# ============================================================================
# ENUMS & TYPES
# ============================================================================

class LLMProviderType(str, Enum):
    """Supported LLM provider types"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    OLLAMA = "ollama"
    COHERE = "cohere"
    MISTRAL = "mistral"


class ModelCapability(str, Enum):
    """What tasks the model can perform"""
    CONTENT_GENERATION = "content_generation"
    EVALUATION = "evaluation"
    SUMMARIZATION = "summarization"
    TEST_GENERATION = "test_generation"
    EXPLANATION = "explanation"
    CODE_REVIEW = "code_review"
    ALL = "all"


# ============================================================================
# MODELS
# ============================================================================

class LLMModelConfig(BaseModel):
    """Configuration for a specific LLM model"""
    provider: LLMProviderType
    model_id: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    timeout_seconds: int = Field(default=60, ge=10)
    capabilities: List[ModelCapability] = Field(default_factory=lambda: [ModelCapability.ALL])
    rate_limit_requests_per_minute: int = Field(default=100)
    cost_per_1k_input_tokens: Optional[float] = None
    cost_per_1k_output_tokens: Optional[float] = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: Optional[datetime] = None
    total_requests: int = 0
    total_tokens_used: int = 0
    
    class Config:
        use_enum_values = False


class LLMUserConfig(BaseModel):
    """User's LLM preference and configuration"""
    user_id: str
    primary_provider: LLMProviderType
    primary_model: str
    secondary_models: List[str] = []
    preferences: Dict[str, Any] = {}
    provider_configs: Dict[LLMProviderType, LLMModelConfig] = {}
    budget_limit_monthly_dollars: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LLMRequest(BaseModel):
    """Standardized LLM request"""
    system_prompt: str
    user_prompt: str
    task_type: str  # content_generation, evaluation, etc.
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    extra_params: Dict[str, Any] = {}


class LLMResponse(BaseModel):
    """Standardized LLM response"""
    content: str
    model: str
    provider: LLMProviderType
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_dollars: Optional[float] = None
    latency_ms: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    raw_response: Optional[Dict[str, Any]] = None


# ============================================================================
# BASE PROVIDER CLASS
# ============================================================================

class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, config: LLMModelConfig):
        self.config = config
        self.client = None
        self._initialize_client()
    
    @abstractmethod
    def _initialize_client(self):
        """Initialize the LLM client"""
        pass
    
    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate a response from the LLM"""
        pass
    
    @abstractmethod
    async def stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Stream a response from the LLM"""
        pass
    
    async def validate_connection(self) -> bool:
        """Test connection to the LLM service"""
        try:
            test_request = LLMRequest(
                system_prompt="You are a helpful assistant.",
                user_prompt="Say 'OK' if you can hear me.",
                task_type="test"
            )
            response = await self.generate(test_request)
            return "ok" in response.content.lower()
        except Exception as e:
            print(f"Connection validation failed: {e}")
            return False


# ============================================================================
# OPENAI PROVIDER
# ============================================================================

class OpenAIProvider(BaseLLMProvider):
    """OpenAI (GPT-4, GPT-3.5-turbo, etc.)"""
    
    def _initialize_client(self):
        try:
            import openai
            self.openai = openai
            api_key = self.config.api_key or os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OpenAI API key not found")
            self.client = openai.AsyncOpenAI(api_key=api_key)
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        import time
        start_time = time.time()
        
        messages = [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_prompt}
        ]
        
        response = await self.client.chat.completions.create(
            model=self.config.model_id,
            messages=messages,
            temperature=request.temperature or self.config.temperature,
            max_tokens=request.max_tokens or self.config.max_tokens,
            top_p=self.config.top_p,
            **request.extra_params
        )
        
        latency = (time.time() - start_time) * 1000
        
        return LLMResponse(
            content=response.choices[0].message.content,
            model=self.config.model_id,
            provider=LLMProviderType.OPENAI,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            latency_ms=latency,
            raw_response=response.model_dump()
        )
    
    async def stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        messages = [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_prompt}
        ]
        
        stream = await self.client.chat.completions.create(
            model=self.config.model_id,
            messages=messages,
            temperature=request.temperature or self.config.temperature,
            max_tokens=request.max_tokens or self.config.max_tokens,
            stream=True,
            **request.extra_params
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


# ============================================================================
# ANTHROPIC PROVIDER
# ============================================================================

class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude (Claude 3.5, etc.)"""
    
    def _initialize_client(self):
        try:
            from anthropic import AsyncAnthropic
            api_key = self.config.api_key or os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("Anthropic API key not found")
            self.client = AsyncAnthropic(api_key=api_key)
        except ImportError:
            raise ImportError("anthropic package not installed. Run: pip install anthropic")
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        import time
        start_time = time.time()
        
        full_prompt = f"{request.system_prompt}\n\n{request.user_prompt}"
        
        response = await self.client.messages.create(
            model=self.config.model_id,
            max_tokens=request.max_tokens or self.config.max_tokens,
            temperature=request.temperature or self.config.temperature,
            messages=[{"role": "user", "content": full_prompt}]
        )
        
        latency = (time.time() - start_time) * 1000
        
        return LLMResponse(
            content=response.content[0].text,
            model=self.config.model_id,
            provider=LLMProviderType.ANTHROPIC,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            total_tokens=response.usage.input_tokens + response.usage.output_tokens,
            latency_ms=latency,
            raw_response=response.model_dump()
        )
    
    async def stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        full_prompt = f"{request.system_prompt}\n\n{request.user_prompt}"
        
        with self.client.messages.stream(
            model=self.config.model_id,
            max_tokens=request.max_tokens or self.config.max_tokens,
            temperature=request.temperature or self.config.temperature,
            messages=[{"role": "user", "content": full_prompt}]
        ) as stream:
            for text in stream.text_stream:
                yield text


# ============================================================================
# GROQ PROVIDER
# ============================================================================

class GroqProvider(BaseLLMProvider):
    """Groq (Ultra-fast inference)"""
    
    def _initialize_client(self):
        try:
            from groq import AsyncGroq
            api_key = self.config.api_key or os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError("Groq API key not found")
            self.client = AsyncGroq(api_key=api_key)
        except ImportError:
            raise ImportError("groq package not installed. Run: pip install groq")
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        import time
        start_time = time.time()
        
        messages = [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_prompt}
        ]
        
        response = await self.client.chat.completions.create(
            model=self.config.model_id,
            messages=messages,
            temperature=request.temperature or self.config.temperature,
            max_tokens=request.max_tokens or self.config.max_tokens,
            **request.extra_params
        )
        
        latency = (time.time() - start_time) * 1000
        
        return LLMResponse(
            content=response.choices[0].message.content,
            model=self.config.model_id,
            provider=LLMProviderType.GROQ,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            latency_ms=latency,
            raw_response=response.model_dump()
        )
    
    async def stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        messages = [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_prompt}
        ]
        
        stream = await self.client.chat.completions.create(
            model=self.config.model_id,
            messages=messages,
            temperature=request.temperature or self.config.temperature,
            max_tokens=request.max_tokens or self.config.max_tokens,
            stream=True,
            **request.extra_params
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


# ============================================================================
# OLLAMA PROVIDER (Local)
# ============================================================================

class OllamaProvider(BaseLLMProvider):
    """Ollama - Run models locally"""
    
    def _initialize_client(self):
        base_url = self.config.base_url or "http://localhost:11434"
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=self.config.timeout_seconds)
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        import time
        start_time = time.time()
        
        prompt = f"{request.system_prompt}\n\n{request.user_prompt}"
        
        response = await self.client.post(
            "/api/generate",
            json={
                "model": self.config.model_id,
                "prompt": prompt,
                "temperature": request.temperature or self.config.temperature,
                "stream": False
            }
        )
        
        latency = (time.time() - start_time) * 1000
        data = response.json()
        
        return LLMResponse(
            content=data.get("response", ""),
            model=self.config.model_id,
            provider=LLMProviderType.OLLAMA,
            input_tokens=data.get("prompt_eval_count", 0),
            output_tokens=data.get("eval_count", 0),
            total_tokens=data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
            latency_ms=latency,
            raw_response=data
        )
    
    async def stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        prompt = f"{request.system_prompt}\n\n{request.user_prompt}"
        
        async with self.client.stream(
            "POST",
            "/api/generate",
            json={
                "model": self.config.model_id,
                "prompt": prompt,
                "temperature": request.temperature or self.config.temperature,
                "stream": True
            }
        ) as response:
            async for line in response.aiter_lines():
                if line:
                    data = json.loads(line)
                    if "response" in data:
                        yield data["response"]


# ============================================================================
# PROVIDER FACTORY
# ============================================================================

class LLMProviderFactory:
    """Factory for creating LLM providers"""
    
    _providers = {
        LLMProviderType.OPENAI: OpenAIProvider,
        LLMProviderType.ANTHROPIC: AnthropicProvider,
        LLMProviderType.GROQ: GroqProvider,
        LLMProviderType.OLLAMA: OllamaProvider,
    }
    
    @classmethod
    def create(cls, config: LLMModelConfig) -> BaseLLMProvider:
        """Create a provider instance"""
        provider_class = cls._providers.get(config.provider)
        if not provider_class:
            raise ValueError(f"Unsupported provider: {config.provider}")
        return provider_class(config)
