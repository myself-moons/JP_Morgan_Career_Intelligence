import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
import jwt
from fastapi import Depends, HTTPException, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User, utcnow

# Simple in-memory per-user sliding-window rate limiter for AI endpoints
_AI_CALL_TIMESTAMPS: Dict[int, deque] = defaultdict(deque)


def check_ai_rate_limit(user_id: int) -> None:
    """Prevents single-user quota exhaustion by limiting explicit AI calls per hour."""
    limit = settings.AI_RATE_LIMIT_PER_HOUR
    now = time.time()
    window = _AI_CALL_TIMESTAMPS[user_id]
    while window and (now - window[0]) > 3600:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI rate limit reached ({limit} calls/hour). Cached results remain available.",
        )
    window.append(now)


def verify_google_credential(credential: str) -> dict:
    """Verifies a Google OAuth2/OIDC ID token against configured GOOGLE_CLIENT_ID."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Login is not configured on this server (missing GOOGLE_CLIENT_ID).",
        )
    try:
        info = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=60,
        )
        if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Invalid token issuer")
        if not info.get("sub") or not info.get("email"):
            raise ValueError("Missing Google subject or email")
        return info
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google credential: {exc}",
        )


def create_session_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "google_sub": user.google_sub,
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.SESSION_EXPIRE_HOURS)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_session_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def get_or_create_local_dev_user(db: Session) -> User:
    user = db.query(User).filter(User.google_sub == "local-dev").first()
    if not user:
        user = User(
            google_sub="local-dev",
            email="local@jci.local",
            display_name="Local Workspace",
            avatar_url=None,
            is_local_dev=1,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def upsert_google_user(db: Session, token_info: dict) -> User:
    sub = str(token_info["sub"])
    user = db.query(User).filter(User.google_sub == sub).first()
    if user:
        user.email = token_info.get("email", user.email)
        user.display_name = token_info.get("name") or user.email.split("@")[0]
        user.avatar_url = token_info.get("picture")
        user.last_login_at = utcnow()
        db.commit()
        db.refresh(user)
        return user

    user = User(
        google_sub=sub,
        email=token_info["email"],
        display_name=token_info.get("name") or token_info["email"].split("@")[0],
        avatar_url=token_info.get("picture"),
        is_local_dev=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _extract_token(request: Request) -> Optional[str]:
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Resolves authenticated user from HttpOnly JWT session cookie (or Bearer token).
    When JCI_AUTH_REQUIRED=false (local offline mode), falls back to the local workspace user.
    """
    token = _extract_token(request)
    if token:
        payload = decode_session_token(token)
        if payload and payload.get("sub"):
            try:
                user_id = int(payload["sub"])
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    return user
            except (ValueError, TypeError):
                pass

    if not settings.AUTH_REQUIRED:
        return get_or_create_local_dev_user(db)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please sign in with Google.",
    )
