"""
Authentication Router - User registration, login, and account management
"""

from fastapi import APIRouter, HTTPException, Depends, status, Header
from auth import (
    UserService, UserProfile, UserCredentials, UserRegistration,
    PasswordResetRequest, PasswordReset, UserSettings, auth_service
)
from database import db
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
user_service = UserService(db)


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@router.post("/auth/register")
async def register(registration: UserRegistration):
    """Register a new user"""
    try:
        user = await user_service.register(registration)
        token = auth_service.create_tokens(user.id, user.email)
        return {
            "success": True,
            "message": "User registered successfully",
            "access_token": token.access_token,
            "refresh_token": token.refresh_token,
            "token_type": token.token_type,
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username if hasattr(user, 'username') else None,
                "display_name": user.display_name if hasattr(user, 'display_name') else None,
                "role": user.role if hasattr(user, 'role') else None
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")


@router.post("/auth/login")
async def login(credentials: UserCredentials):
    """Login user"""
    try:
        token = await user_service.login(credentials)
        user = await user_service.get_user_by_email(credentials.email)
        return {
            "access_token": token.access_token,
            "refresh_token": token.refresh_token,
            "token_type": token.token_type,
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username if hasattr(user, 'username') else None,
                "display_name": user.display_name if hasattr(user, 'display_name') else None,
                "role": user.role if hasattr(user, 'role') else None
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


@router.post("/auth/refresh")
async def refresh(refresh_token: str):
    """Refresh access token"""
    try:
        token = await user_service.refresh_token(refresh_token)
        return token.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/auth/password-reset/request")
async def request_password_reset(request: PasswordResetRequest):
    """Request password reset"""
    result = await user_service.request_password_reset(request)
    return result


@router.post("/auth/password-reset")
async def reset_password(reset: PasswordReset):
    """Reset password"""
    try:
        result = await user_service.reset_password(reset)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# USER PROFILE ENDPOINTS
# ============================================================================

@router.get("/auth/users/me")
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user profile"""
    try:
        # Extract user_id from token (this is a simplified version)
        # In production, use proper JWT verification
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization header")
        
        token = authorization.replace("Bearer ", "")
        payload = auth_service.verify_token(token)
        user_id = payload.get("sub")
        
        user = await user_service.get_user(user_id)
        return user.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user")


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile"""
    try:
        user = await user_service.get_user(user_id)
        return {
            "user": user.model_dump()
        }
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")


@router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict):
    """Update user profile"""
    try:
        # Prevent certain fields from being updated
        protected_fields = ["id", "email", "created_at"]
        for field in protected_fields:
            updates.pop(field, None)
        
        user = await user_service.update_user(user_id, updates)
        return {
            "success": True,
            "user": user.model_dump()
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Update error: {e}")
        raise HTTPException(status_code=400, detail="Update failed")


@router.get("/users/{user_id}/settings")
async def get_user_settings(user_id: str):
    """Get user settings"""
    try:
        settings = await user_service.get_user_settings(user_id)
        return settings.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch settings")


@router.put("/users/{user_id}/settings")
async def update_user_settings(user_id: str, settings: UserSettings):
    """Update user settings"""
    try:
        updated = await user_service.update_user_settings(user_id, settings)
        return {
            "success": True,
            "settings": updated.model_dump()
        }
    except Exception as e:
        logger.error(f"Settings update error: {e}")
        raise HTTPException(status_code=400, detail="Settings update failed")


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete user account"""
    try:
        result = await user_service.delete_user(user_id)
        return result
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=400, detail="Deletion failed")


# ============================================================================
# USER DISCOVERY ENDPOINTS
# ============================================================================

@router.get("/users/search")
async def search_users(query: str, limit: int = 10):
    """Search users by username or display name"""
    try:
        users = db.search_users(query, limit)
        return {
            "results": [
                {
                    "id": u.id,
                    "username": u.username,
                    "display_name": u.display_name,
                    "avatar_url": u.avatar_url
                }
                for u in users
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/users/{user_id}/public-profile")
async def get_public_profile(user_id: str):
    """Get public user profile (limited info)"""
    try:
        user = await user_service.get_user(user_id)
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "created_at": user.created_at,
            "role": user.role
        }
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@router.get("/admin/users")
async def list_users(skip: int = 0, limit: int = 100):
    """List all users (admin only)"""
    # TODO: Add permission check
    users = db.list_users(skip=skip, limit=limit)
    return {
        "total": len(users),
        "users": [u.model_dump() for u in users]
    }


@router.get("/admin/users/{user_id}/activity")
async def get_user_activity(user_id: str):
    """Get user activity logs (admin only)"""
    # TODO: Add permission check
    activity = db.get_user_activity(user_id)
    return {
        "user_id": user_id,
        "activity": activity
    }


@router.post("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, role: str):
    """Update user role (admin only)"""
    # TODO: Add permission check
    try:
        user = await user_service.get_user(user_id)
        user.role = role
        updated_user = await user_service.update_user(user_id, {"role": role})
        return {
            "success": True,
            "user": updated_user.model_dump()
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str):
    """Suspend user account (admin only)"""
    # TODO: Add permission check
    try:
        user = await user_service.update_user(user_id, {"is_active": False})
        return {
            "success": True,
            "message": f"User {user_id} suspended"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/admin/users/{user_id}/unsuspend")
async def unsuspend_user(user_id: str):
    """Unsuspend user account (admin only)"""
    # TODO: Add permission check
    try:
        user = await user_service.update_user(user_id, {"is_active": True})
        return {
            "success": True,
            "message": f"User {user_id} unsuspended"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
