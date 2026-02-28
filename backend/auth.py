"""
Authentication & User Management Module
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from enum import Enum
import uuid
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# MODELS
# ============================================================================

class UserRole(str, Enum):
    """User roles"""
    ADMIN = "admin"
    INSTRUCTOR = "instructor"
    LEARNER = "learner"
    RESEARCHER = "researcher"


class UserTier(str, Enum):
    """User subscription tier"""
    FREE = "free"
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class UserProfile(BaseModel):
    """User profile model"""
    id: str
    email: str
    username: str
    display_name: str
    role: UserRole = UserRole.LEARNER
    tier: UserTier = UserTier.FREE
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True
    email_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    # Preferences
    preferred_language: str = "en"
    dark_mode: bool = False
    notifications_enabled: bool = True
    
    # Learning preferences
    preferred_learning_style: str = "balanced"  # visual, textual, interactive, code-focused
    daily_learning_goal_minutes: int = 30
    preferred_llm_model: Optional[str] = None
    
    # Metadata
    metadata: Dict[str, Any] = {}


class UserCredentials(BaseModel):
    """User login credentials"""
    email: str
    password: str


class UserRegistration(BaseModel):
    """User registration data"""
    email: EmailStr
    username: str
    password: str
    display_name: str
    accept_terms: bool = True


class PasswordResetRequest(BaseModel):
    """Password reset request"""
    email: str


class PasswordReset(BaseModel):
    """Password reset"""
    token: str
    new_password: str


class AuthToken(BaseModel):
    """Authentication token"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user_id: str
    email: str


class UserSettings(BaseModel):
    """User settings"""
    user_id: str
    notifications_enabled: bool = True
    email_notifications: bool = True
    push_notifications: bool = False
    newsletter_subscribed: bool = False
    dark_mode: bool = False
    preferred_language: str = "en"
    timezone: str = "UTC"
    metadata: Dict[str, Any] = {}


# ============================================================================
# AUTHENTICATION SERVICE
# ============================================================================

class AuthService:
    """Handles authentication and authorization"""
    
    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 60
        self.refresh_token_expire_days = 7
    
    def hash_password(self, password: str) -> str:
        """Hash password with salt"""
        salt = os.urandom(32)
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return (salt + key).hex()
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        salt = bytes.fromhex(hashed[:64])
        key = bytes.fromhex(hashed[64:])
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return key == new_key
    
    def create_tokens(self, user_id: str, email: str) -> AuthToken:
        """Create access and refresh tokens"""
        import jwt
        
        now = datetime.utcnow()
        access_expires = now + timedelta(minutes=self.access_token_expire_minutes)
        refresh_expires = now + timedelta(days=self.refresh_token_expire_days)
        
        access_payload = {
            "sub": user_id,
            "email": email,
            "type": "access",
            "exp": access_expires,
            "iat": now
        }
        
        refresh_payload = {
            "sub": user_id,
            "email": email,
            "type": "refresh",
            "exp": refresh_expires,
            "iat": now
        }
        
        access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm=self.algorithm)
        
        return AuthToken(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=int((access_expires - now).total_seconds()),
            user_id=user_id,
            email=email
        )
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token"""
        import jwt
        
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token expired")
        except jwt.InvalidTokenError:
            raise ValueError("Invalid token")
    
    def generate_reset_token(self, email: str) -> str:
        """Generate password reset token"""
        import jwt
        
        expires = datetime.utcnow() + timedelta(hours=1)
        payload = {
            "email": email,
            "type": "password_reset",
            "exp": expires,
            "iat": datetime.utcnow()
        }
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_reset_token(self, token: str) -> str:
        """Verify reset token and return email"""
        payload = self.verify_token(token)
        
        if payload.get("type") != "password_reset":
            raise ValueError("Invalid reset token")
        
        return payload.get("email")


# ============================================================================
# USER SERVICE
# ============================================================================

class UserService:
    """Handles user management"""
    
    def __init__(self, db):
        self.db = db
        self.auth_service = AuthService()
    
    async def register(self, registration: UserRegistration) -> UserProfile:
        """Register a new user"""
        
        # Check if user exists
        if self.db.get_user_by_email(registration.email):
            raise ValueError("Email already registered")
        
        if self.db.get_user_by_username(registration.username):
            raise ValueError("Username already taken")
        
        # Create user
        user_id = str(uuid.uuid4())
        hashed_password = self.auth_service.hash_password(registration.password)
        
        user = UserProfile(
            id=user_id,
            email=registration.email,
            username=registration.username,
            display_name=registration.display_name,
            role=UserRole.LEARNER,
            tier=UserTier.FREE
        )
        
        # Save to database
        self.db.save_user(user)
        self.db.save_password_hash(user_id, hashed_password)
        
        return user
    
    async def login(self, credentials: UserCredentials) -> AuthToken:
        """Authenticate user"""
        
        user = self.db.get_user_by_email(credentials.email)
        if not user:
            raise ValueError("Invalid email or password")
        
        password_hash = self.db.get_password_hash(user.id)
        if not self.auth_service.verify_password(credentials.password, password_hash):
            raise ValueError("Invalid email or password")
        
        # Update last login
        user.last_login = datetime.utcnow()
        self.db.save_user(user)
        
        # Create tokens
        return self.auth_service.create_tokens(user.id, user.email)
    
    async def refresh_token(self, refresh_token: str) -> AuthToken:
        """Refresh access token"""
        
        payload = self.auth_service.verify_token(refresh_token)
        
        if payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        return self.auth_service.create_tokens(user_id, email)
    
    async def get_user(self, user_id: str) -> UserProfile:
        """Get user by ID"""
        user = self.db.get_user(user_id)
        if not user:
            raise ValueError("User not found")
        return user
    
    async def get_user_by_email(self, email: str) -> UserProfile:
        """Get user by email"""
        user = self.db.get_user_by_email(email)
        if not user:
            raise ValueError("User not found")
        return user
    
    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> UserProfile:
        """Update user profile"""
        
        user = await self.get_user(user_id)
        
        for key, value in updates.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        user.updated_at = datetime.utcnow()
        self.db.save_user(user)
        
        return user
    
    async def request_password_reset(self, request: PasswordResetRequest) -> Dict[str, str]:
        """Request password reset"""
        
        user = self.db.get_user_by_email(request.email)
        if not user:
            # For security, don't reveal if email exists
            return {"message": "If email exists, password reset link will be sent"}
        
        reset_token = self.auth_service.generate_reset_token(request.email)
        
        # In production, send email with reset link
        # reset_link = f"https://learnos.com/reset-password?token={reset_token}"
        # send_email(user.email, "Password Reset", reset_link)
        
        return {"message": "Password reset link sent to email"}
    
    async def reset_password(self, reset: PasswordReset) -> Dict[str, str]:
        """Reset password"""
        
        email = self.auth_service.verify_reset_token(reset.token)
        user = self.db.get_user_by_email(email)
        
        if not user:
            raise ValueError("User not found")
        
        hashed_password = self.auth_service.hash_password(reset.new_password)
        self.db.save_password_hash(user.id, hashed_password)
        
        return {"message": "Password reset successfully"}
    
    async def get_user_settings(self, user_id: str) -> UserSettings:
        """Get user settings"""
        return self.db.get_user_settings(user_id) or UserSettings(user_id=user_id)
    
    async def update_user_settings(self, user_id: str, settings: UserSettings) -> UserSettings:
        """Update user settings"""
        settings.user_id = user_id
        self.db.save_user_settings(settings)
        return settings
    
    async def delete_user(self, user_id: str) -> Dict[str, str]:
        """Delete user account"""
        self.db.delete_user(user_id)
        return {"message": "User account deleted"}


# Global instances
auth_service = AuthService()
