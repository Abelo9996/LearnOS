from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class AgentMemory(BaseModel):
    short_term: Dict[str, Any] = {}
    long_term: Dict[str, Any] = {}

class Agent(ABC):
    """
    Base class for all LearnOS agents.
    Each agent has a specific role, clear inputs/outputs, memory, and decision logic.
    """
    
    def __init__(self, role: str):
        self.role = role
        self.memory = AgentMemory()
    
    @abstractmethod
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main processing method. Must be implemented by all agents.
        
        Args:
            inputs: Typed input dictionary specific to the agent
            
        Returns:
            Typed output dictionary specific to the agent
        """
        pass
    
    def update_memory(self, key: str, value: Any, term: str = "short"):
        """Update agent memory."""
        if term == "short":
            self.memory.short_term[key] = value
        else:
            self.memory.long_term[key] = value
    
    def get_memory(self, key: str, term: str = "short") -> Optional[Any]:
        """Retrieve from agent memory."""
        if term == "short":
            return self.memory.short_term.get(key)
        return self.memory.long_term.get(key)
    
    def clear_memory(self, term: str = "short"):
        """Clear agent memory."""
        if term == "short":
            self.memory.short_term = {}
        else:
            self.memory.long_term = {}
