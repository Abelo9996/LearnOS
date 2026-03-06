"""
OAuth Provider Configuration — Google and GitHub OAuth2 flows
"""

import os
import uuid
import logging
from typing import Optional, Dict, Any
from datetime import datetime

import httpx
from auth import auth_service, UserProfile, UserRole, UserTier
from database import db

logger = logging.getLogger(__name__)

# OAuth config from environment
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


class OAuthService:
    """Handles OAuth2 flows for Google and GitHub"""

    # ── Google ──────────────────────────────────────────────

    def get_google_auth_url(self, state: Optional[str] = None) -> str:
        redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
        if state:
            params["state"] = state
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://accounts.google.com/o/oauth2/v2/auth?{qs}"

    async def handle_google_callback(self, code: str) -> Dict[str, Any]:
        redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"

        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                raise ValueError(f"Google token exchange failed: {token_resp.text}")
            tokens = token_resp.json()

            # Get user info
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if user_resp.status_code != 200:
                raise ValueError("Failed to get Google user info")
            google_user = user_resp.json()

        return await self._get_or_create_oauth_user(
            provider="google",
            provider_id=google_user["id"],
            email=google_user.get("email", ""),
            name=google_user.get("name", ""),
            avatar_url=google_user.get("picture"),
        )

    # ── GitHub ──────────────────────────────────────────────

    def get_github_auth_url(self, state: Optional[str] = None) -> str:
        redirect_uri = f"{BACKEND_URL}/api/auth/github/callback"
        params = {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": "user:email read:user",
        }
        if state:
            params["state"] = state
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://github.com/login/oauth/authorize?{qs}"

    async def handle_github_callback(self, code: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            # Exchange code for token
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            if token_resp.status_code != 200:
                raise ValueError(f"GitHub token exchange failed: {token_resp.text}")
            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            if not access_token:
                raise ValueError(f"No access token from GitHub: {tokens}")

            # Get user info
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            github_user = user_resp.json()

            # Get primary email if not public
            email = github_user.get("email")
            if not email:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if emails_resp.status_code == 200:
                    for e in emails_resp.json():
                        if e.get("primary"):
                            email = e["email"]
                            break

        return await self._get_or_create_oauth_user(
            provider="github",
            provider_id=str(github_user["id"]),
            email=email or "",
            name=github_user.get("name") or github_user.get("login", ""),
            avatar_url=github_user.get("avatar_url"),
            username=github_user.get("login"),
        )

    # ── Shared ──────────────────────────────────────────────

    async def _get_or_create_oauth_user(
        self,
        provider: str,
        provider_id: str,
        email: str,
        name: str,
        avatar_url: Optional[str] = None,
        username: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Find existing user or create new one from OAuth data, return JWT tokens."""

        # Check if user exists by email
        existing_user = db.get_user_by_email(email) if email else None

        if existing_user:
            user = existing_user
            # Update avatar if not set
            if avatar_url and not getattr(user, "avatar_url", None):
                user.avatar_url = avatar_url
                db.save_user(user)
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            uname = username or email.split("@")[0] if email else f"{provider}_{provider_id}"

            # Ensure username uniqueness
            base_uname = uname
            counter = 1
            while db.get_user_by_username(uname):
                uname = f"{base_uname}{counter}"
                counter += 1

            user = UserProfile(
                id=user_id,
                email=email,
                username=uname,
                display_name=name or uname,
                role=UserRole.LEARNER,
                tier=UserTier.FREE,
                avatar_url=avatar_url,
                email_verified=True,  # OAuth emails are verified
            )
            db.save_user(user)
            # Save a placeholder credential so email lookup works
            db.save_user_credential(email, user_id, "oauth_no_password")

        # Create JWT tokens
        token = auth_service.create_tokens(user.id, user.email)
        return {
            "access_token": token.access_token,
            "refresh_token": token.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "display_name": user.display_name,
                "role": user.role,
                "avatar_url": getattr(user, "avatar_url", None),
            },
        }


oauth_service = OAuthService()
