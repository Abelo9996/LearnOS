"""
LLM Manager - Handles routing, failover, and optimization
"""

from typing import Dict, List, Optional, AsyncGenerator
from llm_providers import (
    BaseLLMProvider, LLMProviderFactory, LLMModelConfig, LLMProviderType,
    LLMRequest, LLMResponse, LLMUserConfig, ModelCapability
)
from database import db
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class LLMManager:
    """
    Central manager for all LLM operations.
    Handles provider selection, failover, cost tracking, and optimization.
    """
    
    def __init__(self):
        self.providers: Dict[str, BaseLLMProvider] = {}
        self.user_configs: Dict[str, LLMUserConfig] = {}
        self.usage_log: List[Dict] = []
    
    # ========================================================================
    # PROVIDER MANAGEMENT
    # ========================================================================
    
    async def register_provider(self, config: LLMModelConfig) -> None:
        """Register a new LLM provider"""
        try:
            provider = LLMProviderFactory.create(config)
            if await provider.validate_connection():
                provider_key = f"{config.provider.value}:{config.model_id}"
                self.providers[provider_key] = provider
                logger.info(f"Provider registered: {provider_key}")
                # Save to database
                db.save_llm_config(config)
            else:
                raise Exception("Connection validation failed")
        except Exception as e:
            logger.error(f"Failed to register provider: {e}")
            raise
    
    async def unregister_provider(self, provider_type: LLMProviderType, model_id: str) -> None:
        """Unregister a provider"""
        provider_key = f"{provider_type.value}:{model_id}"
        if provider_key in self.providers:
            del self.providers[provider_key]
            db.delete_llm_config(provider_type, model_id)
            logger.info(f"Provider unregistered: {provider_key}")
    
    def get_provider(self, provider_type: LLMProviderType, model_id: str) -> Optional[BaseLLMProvider]:
        """Get a specific provider"""
        provider_key = f"{provider_type.value}:{model_id}"
        return self.providers.get(provider_key)
    
    def list_providers(self) -> List[Dict]:
        """List all available providers"""
        return [
            {
                "provider": prov.config.provider.value,
                "model": prov.config.model_id,
                "enabled": prov.config.enabled,
                "total_requests": prov.config.total_requests,
                "capabilities": [c.value for c in prov.config.capabilities]
            }
            for prov in self.providers.values()
        ]
    
    # ========================================================================
    # USER CONFIGURATION
    # ========================================================================
    
    async def set_user_llm_config(self, user_config: LLMUserConfig) -> None:
        """Set LLM configuration for a user"""
        self.user_configs[user_config.user_id] = user_config
        db.save_llm_user_config(user_config)
    
    async def get_user_llm_config(self, user_id: str) -> Optional[LLMUserConfig]:
        """Get LLM configuration for a user"""
        if user_id in self.user_configs:
            return self.user_configs[user_id]
        return db.get_llm_user_config(user_id)
    
    # ========================================================================
    # INTELLIGENT PROVIDER SELECTION
    # ========================================================================
    
    async def select_best_provider(
        self,
        task_type: str,
        user_id: str,
        capability: ModelCapability = ModelCapability.ALL
    ) -> Optional[BaseLLMProvider]:
        """
        Select the best provider based on:
        - User preference
        - Task requirements
        - Provider capability
        - Cost optimization
        - Latency requirements
        """
        user_config = await self.get_user_llm_config(user_id) or self._get_default_config(user_id)
        
        # Get user's primary model
        primary_provider_key = f"{user_config.primary_provider.value}:{user_config.primary_model}"
        primary = self.providers.get(primary_provider_key)
        
        if primary and primary.config.enabled:
            # Check if provider has required capability
            if (ModelCapability.ALL in primary.config.capabilities or 
                capability in primary.config.capabilities):
                return primary
        
        # Find alternative provider with required capability
        for provider in self.providers.values():
            if provider.config.enabled:
                if (ModelCapability.ALL in provider.config.capabilities or 
                    capability in provider.config.capabilities):
                    return provider
        
        logger.warning(f"No suitable provider found for task: {task_type}")
        return None
    
    def _get_default_config(self, user_id: str) -> LLMUserConfig:
        """Get default LLM config for a user"""
        # Try to find any enabled provider
        for provider in self.providers.values():
            if provider.config.enabled:
                return LLMUserConfig(
                    user_id=user_id,
                    primary_provider=provider.config.provider,
                    primary_model=provider.config.model_id
                )
        raise ValueError("No LLM providers configured")
    
    # ========================================================================
    # GENERATION & STREAMING
    # ========================================================================
    
    async def generate(
        self,
        user_id: str,
        request: LLMRequest,
        capability: ModelCapability = ModelCapability.ALL,
        fallback_attempts: int = 2
    ) -> LLMResponse:
        """
        Generate a response with intelligent failover.
        Attempts multiple providers if primary fails.
        """
        attempts = 0
        last_error = None
        
        while attempts < fallback_attempts:
            try:
                provider = await self.select_best_provider(request.task_type, user_id, capability)
                
                if not provider:
                    raise ValueError("No available LLM providers")
                
                response = await provider.generate(request)
                
                # Track usage
                await self._track_usage(user_id, provider, response)
                
                return response
            
            except Exception as e:
                last_error = e
                logger.warning(f"Generation attempt {attempts + 1} failed: {e}")
                attempts += 1
                await asyncio.sleep(1)
        
        raise Exception(f"Generation failed after {fallback_attempts} attempts: {last_error}")
    
    async def stream(
        self,
        user_id: str,
        request: LLMRequest,
        capability: ModelCapability = ModelCapability.ALL
    ) -> AsyncGenerator[str, None]:
        """Stream a response from the best available provider"""
        provider = await self.select_best_provider(request.task_type, user_id, capability)
        
        if not provider:
            raise ValueError("No available LLM providers")
        
        async for chunk in provider.stream(request):
            yield chunk
    
    # ========================================================================
    # USAGE TRACKING & OPTIMIZATION
    # ========================================================================
    
    async def _track_usage(self, user_id: str, provider: BaseLLMProvider, response: LLMResponse) -> None:
        """Track LLM usage for analytics and billing"""
        # Calculate cost
        cost = 0.0
        if provider.config.cost_per_1k_input_tokens and provider.config.cost_per_1k_output_tokens:
            cost = (
                (response.input_tokens / 1000) * provider.config.cost_per_1k_input_tokens +
                (response.output_tokens / 1000) * provider.config.cost_per_1k_output_tokens
            )
        
        usage_entry = {
            "user_id": user_id,
            "provider": provider.config.provider.value,
            "model": provider.config.model_id,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "total_tokens": response.total_tokens,
            "cost_dollars": cost,
            "latency_ms": response.latency_ms,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.usage_log.append(usage_entry)
        
        # Update provider stats
        provider.config.last_used = datetime.utcnow()
        provider.config.total_requests += 1
        provider.config.total_tokens_used += response.total_tokens
        
        # Save to database
        db.log_llm_usage(usage_entry)
    
    async def get_usage_stats(self, user_id: Optional[str] = None) -> Dict:
        """Get usage statistics"""
        if user_id:
            user_logs = [log for log in self.usage_log if log["user_id"] == user_id]
        else:
            user_logs = self.usage_log
        
        if not user_logs:
            return {"total_tokens": 0, "total_cost": 0, "request_count": 0}
        
        return {
            "total_tokens": sum(log["total_tokens"] for log in user_logs),
            "total_cost": sum(log["cost_dollars"] for log in user_logs),
            "request_count": len(user_logs),
            "average_latency_ms": sum(log["latency_ms"] for log in user_logs) / len(user_logs),
            "by_provider": self._group_by_provider(user_logs)
        }
    
    def _group_by_provider(self, logs: List[Dict]) -> Dict:
        """Group usage by provider"""
        grouped = {}
        for log in logs:
            key = f"{log['provider']}:{log['model']}"
            if key not in grouped:
                grouped[key] = {"tokens": 0, "cost": 0, "requests": 0}
            grouped[key]["tokens"] += log["total_tokens"]
            grouped[key]["cost"] += log["cost_dollars"]
            grouped[key]["requests"] += 1
        return grouped
    
    # ========================================================================
    # ADVANCED FEATURES
    # ========================================================================
    
    async def compare_responses(self, user_id: str, request: LLMRequest, num_providers: int = 3) -> List[LLMResponse]:
        """Get responses from multiple providers for comparison"""
        providers = list(self.providers.values())[:num_providers]
        responses = await asyncio.gather(
            *[provider.generate(request) for provider in providers],
            return_exceptions=True
        )
        
        # Filter out exceptions
        return [r for r in responses if isinstance(r, LLMResponse)]
    
    async def get_fastest_response(self, user_id: str, request: LLMRequest) -> LLMResponse:
        """Get response from fastest available provider"""
        responses = await self.compare_responses(user_id, request, num_providers=3)
        
        if not responses:
            raise ValueError("No successful responses")
        
        return min(responses, key=lambda r: r.latency_ms)
    
    async def get_cheapest_response(self, user_id: str, request: LLMRequest) -> LLMResponse:
        """Get response from cheapest provider"""
        responses = await self.compare_responses(user_id, request, num_providers=3)
        
        if not responses:
            raise ValueError("No successful responses")
        
        return min(responses, key=lambda r: r.cost_dollars or 0)


# Global instance
llm_manager = LLMManager()
