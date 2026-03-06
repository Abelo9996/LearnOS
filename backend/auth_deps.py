"""
Auth Dependencies — FastAPI dependencies for extracting authenticated user from JWT
"""

from fastapi import Header, HTTPException, Depends
from auth import auth_service
from typing import Optional


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract user_id from JWT token. Returns user_id string.
    
    For routes that require authentication.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = auth_service.verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


async def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user_id from JWT if present, otherwise return None.
    
    For routes that work with or without authentication (offline mode).
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = auth_service.verify_token(token)
        return payload.get("sub")
    except (ValueError, Exception):
        return None
