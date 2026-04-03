from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.firebase_auth import UserContext, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserContext)
def me(user: UserContext = Depends(get_current_user)) -> UserContext:
    return user
