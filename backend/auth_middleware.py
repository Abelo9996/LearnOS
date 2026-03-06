"""
Auth Middleware — Enforces JWT authentication on all /api/ routes except public ones.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from auth import auth_service
import logging
import os

logger = logging.getLogger(__name__)

# Routes that don't require authentication
PUBLIC_ROUTES = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    # Auth endpoints
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/password-reset/request",
    "/api/auth/password-reset",
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/github",
    "/api/auth/github/callback",
    "/api/auth/providers",
}

# Route prefixes that are public
PUBLIC_PREFIXES = (
    "/docs",
    "/redoc",
    "/openapi",
    "/api/marketplace/explore",
    "/api/marketplace/categories",
    "/api/marketplace/featured",
    "/api/marketplace/course/",
    "/api/marketplace/author/",
    "/api/social/discussions/",
    "/api/social/leaderboard/",
    "/api/social/activity",
)

# Environment flag: set LEARNOS_MODE=offline to disable auth enforcement
LEARNOS_MODE = os.getenv("LEARNOS_MODE", "online")


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces JWT authentication on all API routes.
    
    - In ONLINE mode: all /api/ routes require valid JWT (except public routes)
    - In OFFLINE mode: auth is not enforced (all routes accessible)
    - OPTIONS requests always pass through (CORS preflight)
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Always allow OPTIONS (CORS preflight)
        if method == "OPTIONS":
            return await call_next(request)

        # Always allow public routes
        if path in PUBLIC_ROUTES or any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        # In offline mode, don't enforce auth
        if LEARNOS_MODE == "offline":
            return await call_next(request)

        # For /api/ routes, require authentication
        if path.startswith("/api/"):
            auth_header = request.headers.get("authorization")
            
            if not auth_header or not auth_header.startswith("Bearer "):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication required. Please log in."}
                )

            token = auth_header.replace("Bearer ", "")
            try:
                payload = auth_service.verify_token(token)
                # Inject user_id into request state for downstream use
                request.state.user_id = payload.get("sub")
                request.state.user_email = payload.get("email")
            except ValueError as e:
                return JSONResponse(
                    status_code=401,
                    content={"detail": f"Invalid or expired token: {str(e)}"}
                )

        return await call_next(request)
