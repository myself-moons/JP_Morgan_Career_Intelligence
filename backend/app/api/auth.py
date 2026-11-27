from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.auth import (
    _extract_token,
    create_session_token,
    decode_session_token,
    get_current_user,
    get_or_create_local_dev_user,
    upsert_google_user,
    verify_google_credential,
)
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User
from app.models.schemas import AuthConfigOut, GoogleLoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/config", response_model=AuthConfigOut, summary="Public auth configuration for frontend")
def get_auth_config():
    return AuthConfigOut(
        google_client_id=settings.GOOGLE_CLIENT_ID,
        auth_required=settings.AUTH_REQUIRED,
        version=settings.VERSION,
    )


@router.post("/google", response_model=UserOut, summary="Sign in using Google ID token and issue HttpOnly cookie")
def login_with_google(
    payload: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    token_info = verify_google_credential(payload.credential)
    user = upsert_google_user(db, token_info)
    session_jwt = create_session_token(user)

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_jwt,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        path="/",
    )
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut, summary="Return currently authenticated user")
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.get("/session", summary="Check current session quietly without 401 console noise")
def get_session(request: Request, db: Session = Depends(get_db)):
    token = _extract_token(request)
    if token:
        payload = decode_session_token(token)
        if payload and payload.get("sub"):
            try:
                user = db.query(User).filter(User.id == int(payload["sub"])).first()
                if user:
                    return {"authenticated": True, "user": UserOut.model_validate(user)}
            except (ValueError, TypeError):
                pass
    if not settings.AUTH_REQUIRED:
        return {"authenticated": True, "user": UserOut.model_validate(get_or_create_local_dev_user(db))}
    return {"authenticated": False, "user": None}


@router.post("/logout", summary="Clear session cookie")
def logout(response: Response):
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"status": "logged_out"}
