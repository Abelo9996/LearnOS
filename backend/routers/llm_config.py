"""
LLM Configuration Router - API endpoints for managing LLM providers and user configurations
"""

from fastapi import APIRouter, HTTPException, Query
from llm_providers import LLMModelConfig, LLMUserConfig, LLMProviderType, ModelCapability
from llm_manager import llm_manager
from database import db
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# PROVIDER MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/api/llm/providers/register")
async def register_provider(config: LLMModelConfig):
    """Register a new LLM provider"""
    try:
        await llm_manager.register_provider(config)
        return {
            "success": True,
            "message": f"Provider {config.provider.value}:{config.model_id} registered successfully",
            "provider": config.model_dump()
        }
    except Exception as e:
        logger.error(f"Failed to register provider: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/llm/providers")
async def list_providers():
    """List all registered LLM providers"""
    providers = llm_manager.list_providers()
    return {
        "total": len(providers),
        "providers": providers
    }


@router.get("/api/llm/providers/{provider_type}/{model_id}")
async def get_provider(provider_type: str, model_id: str):
    """Get details for a specific provider"""
    try:
        provider_enum = LLMProviderType(provider_type)
        provider = llm_manager.get_provider(provider_enum, model_id)
        
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        return {
            "provider": provider.config.provider.value,
            "model": provider.config.model_id,
            "enabled": provider.config.enabled,
            "total_requests": provider.config.total_requests,
            "total_tokens_used": provider.config.total_tokens_used,
            "capabilities": [c.value for c in provider.config.capabilities],
            "last_used": provider.config.last_used,
            "created_at": provider.config.created_at
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider type")


@router.delete("/api/llm/providers/{provider_type}/{model_id}")
async def unregister_provider(provider_type: str, model_id: str):
    """Unregister an LLM provider"""
    try:
        provider_enum = LLMProviderType(provider_type)
        await llm_manager.unregister_provider(provider_enum, model_id)
        
        return {
            "success": True,
            "message": f"Provider {provider_type}:{model_id} unregistered"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/llm/providers/{provider_type}/{model_id}/test")
async def test_provider_connection(provider_type: str, model_id: str):
    """Test connection to a provider"""
    try:
        provider_enum = LLMProviderType(provider_type)
        provider = llm_manager.get_provider(provider_enum, model_id)
        
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        is_valid = await provider.validate_connection()
        
        return {
            "provider": provider_type,
            "model": model_id,
            "connection_valid": is_valid
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider type")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# USER CONFIGURATION ENDPOINTS
# ============================================================================

@router.post("/api/llm/users/{user_id}/config")
async def set_user_llm_config(user_id: str, config: LLMUserConfig):
    """Set LLM configuration for a user"""
    try:
        if config.user_id != user_id:
            raise HTTPException(status_code=400, detail="User ID mismatch")
        
        await llm_manager.set_user_llm_config(config)
        
        return {
            "success": True,
            "message": f"LLM configuration set for user {user_id}",
            "config": config.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/llm/users/{user_id}/config")
async def get_user_llm_config(user_id: str):
    """Get LLM configuration for a user"""
    config = await llm_manager.get_user_llm_config(user_id)
    
    if not config:
        raise HTTPException(status_code=404, detail="User configuration not found")
    
    return config.model_dump()


@router.post("/api/llm/users/{user_id}/primary-model")
async def set_primary_model(user_id: str, provider: LLMProviderType, model_id: str):
    """Set primary LLM model for a user"""
    try:
        config = await llm_manager.get_user_llm_config(user_id)
        
        if not config:
            config = LLMUserConfig(
                user_id=user_id,
                primary_provider=provider,
                primary_model=model_id
            )
        else:
            config.primary_provider = provider
            config.primary_model = model_id
        
        await llm_manager.set_user_llm_config(config)
        
        return {
            "success": True,
            "message": f"Primary model set to {provider.value}:{model_id}",
            "config": config.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# USAGE AND ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/api/llm/usage")
async def get_usage_stats(user_id: Optional[str] = Query(None)):
    """Get LLM usage statistics"""
    stats = await llm_manager.get_usage_stats(user_id)
    return stats


@router.get("/api/llm/usage/logs")
async def get_usage_logs(user_id: Optional[str] = Query(None), limit: int = Query(100)):
    """Get detailed usage logs"""
    logs = db.get_llm_usage_logs(user_id)
    return {
        "total_logs": len(logs),
        "logs": logs[-limit:]
    }


@router.get("/api/llm/analytics/cost")
async def get_cost_analytics(user_id: Optional[str] = Query(None)):
    """Get cost analytics"""
    stats = await llm_manager.get_usage_stats(user_id)
    
    return {
        "total_cost_dollars": stats.get("total_cost", 0),
        "total_tokens": stats.get("total_tokens", 0),
        "request_count": stats.get("request_count", 0),
        "cost_per_request": stats.get("total_cost", 0) / max(stats.get("request_count", 1), 1),
        "cost_per_1k_tokens": (stats.get("total_cost", 0) / max(stats.get("total_tokens", 1), 1)) * 1000,
        "by_provider": stats.get("by_provider", {})
    }


@router.get("/api/llm/analytics/performance")
async def get_performance_analytics():
    """Get performance analytics (latency, throughput)"""
    logs = db.get_llm_usage_logs()
    
    if not logs:
        return {
            "average_latency_ms": 0,
            "min_latency_ms": 0,
            "max_latency_ms": 0,
            "requests_per_minute": 0
        }
    
    latencies = [log.get("latency_ms", 0) for log in logs]
    
    return {
        "average_latency_ms": sum(latencies) / len(latencies),
        "min_latency_ms": min(latencies),
        "max_latency_ms": max(latencies),
        "median_latency_ms": sorted(latencies)[len(latencies) // 2],
        "total_requests": len(logs),
        "by_provider": self._group_performance_by_provider(logs)
    }


def _group_performance_by_provider(logs: List[Dict]) -> Dict:
    """Group performance metrics by provider"""
    grouped = {}
    for log in logs:
        key = f"{log['provider']}:{log['model']}"
        if key not in grouped:
            grouped[key] = {"latencies": [], "request_count": 0}
        grouped[key]["latencies"].append(log.get("latency_ms", 0))
        grouped[key]["request_count"] += 1
    
    result = {}
    for key, data in grouped.items():
        latencies = data["latencies"]
        result[key] = {
            "average_latency_ms": sum(latencies) / len(latencies),
            "min_latency_ms": min(latencies),
            "max_latency_ms": max(latencies),
            "request_count": data["request_count"]
        }
    
    return result


# ============================================================================
# COMPARISON AND OPTIMIZATION ENDPOINTS
# ============================================================================

@router.post("/api/llm/compare")
async def compare_providers(user_id: str, prompt: Dict[str, str], num_providers: int = Query(3, ge=1, le=5)):
    """Compare responses from multiple providers"""
    try:
        from llm_providers import LLMRequest
        
        request = LLMRequest(
            system_prompt=prompt.get("system_prompt", ""),
            user_prompt=prompt.get("user_prompt", ""),
            task_type=prompt.get("task_type", "comparison")
        )
        
        responses = await llm_manager.compare_responses(user_id, request, num_providers)
        
        return {
            "responses": [
                {
                    "provider": r.provider.value,
                    "model": r.model,
                    "content": r.content[:500],  # First 500 chars
                    "latency_ms": r.latency_ms,
                    "cost_dollars": r.cost_dollars,
                    "tokens": r.total_tokens
                }
                for r in responses
            ],
            "comparison_complete": True
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/llm/fastest")
async def get_fastest_response(user_id: str, prompt: Dict[str, str]):
    """Get response from fastest provider"""
    try:
        from llm_providers import LLMRequest
        
        request = LLMRequest(
            system_prompt=prompt.get("system_prompt", ""),
            user_prompt=prompt.get("user_prompt", ""),
            task_type=prompt.get("task_type", "optimization")
        )
        
        response = await llm_manager.get_fastest_response(user_id, request)
        
        return {
            "provider": response.provider.value,
            "model": response.model,
            "content": response.content,
            "latency_ms": response.latency_ms,
            "cost_dollars": response.cost_dollars,
            "tokens": response.total_tokens
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/llm/cheapest")
async def get_cheapest_response(user_id: str, prompt: Dict[str, str]):
    """Get response from cheapest provider"""
    try:
        from llm_providers import LLMRequest
        
        request = LLMRequest(
            system_prompt=prompt.get("system_prompt", ""),
            user_prompt=prompt.get("user_prompt", ""),
            task_type=prompt.get("task_type", "optimization")
        )
        
        response = await llm_manager.get_cheapest_response(user_id, request)
        
        return {
            "provider": response.provider.value,
            "model": response.model,
            "content": response.content,
            "latency_ms": response.latency_ms,
            "cost_dollars": response.cost_dollars,
            "tokens": response.total_tokens
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
