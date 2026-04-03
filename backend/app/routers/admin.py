from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from firebase_admin import auth as firebase_admin_auth
from pydantic import BaseModel, Field

from app.auth.firebase_auth import (
    ROLE_OPTIONS,
    UserContext,
    normalize_role,
    permissions_for_role,
    role_from_claims,
    require_any_permissions,
)

router = APIRouter(prefix="/admin", tags=["admin"])


class UserSummary(BaseModel):
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    permissions: list[str] = Field(default_factory=list)


class UsersResponse(BaseModel):
    users: list[UserSummary]
    next_page_token: Optional[str] = None


class RoleUpdate(BaseModel):
    role: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str
    display_name: Optional[str] = None


@router.get("/users", response_model=UsersResponse)
async def list_users(
    limit: int = Query(100, ge=1, le=1000),
    page_token: Optional[str] = None,
    user: UserContext = Depends(require_any_permissions("admin.full")),
) -> UsersResponse:
    page = firebase_admin_auth.list_users(page_token=page_token, max_results=limit)
    users: list[UserSummary] = []

    for record in page.users:
        claims = record.custom_claims or {}
        role = role_from_claims(claims)
        users.append(
            UserSummary(
                uid=record.uid,
                email=record.email,
                display_name=record.display_name,
                role=role,
                permissions=permissions_for_role(role),
            )
        )

    return UsersResponse(users=users, next_page_token=page.next_page_token)


@router.patch("/users/{uid}/role", response_model=UserSummary)
async def set_user_role(
    uid: str,
    payload: RoleUpdate,
    user: UserContext = Depends(require_any_permissions("admin.full")),
) -> UserSummary:
    role = normalize_role(payload.role)
    if not role or role not in ROLE_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid role")

    firebase_admin_auth.set_custom_user_claims(uid, {"role": role})
    record = firebase_admin_auth.get_user(uid)
    claims = record.custom_claims or {}
    role_value = role_from_claims(claims)

    return UserSummary(
        uid=record.uid,
        email=record.email,
        display_name=record.display_name,
        role=role_value,
        permissions=permissions_for_role(role_value),
    )


@router.post("/users", response_model=UserSummary)
async def create_user(
    payload: CreateUserRequest,
    user: UserContext = Depends(require_any_permissions("admin.full")),
) -> UserSummary:
    role = normalize_role(payload.role)
    if not role or role not in ROLE_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid role")

    try:
        record = firebase_admin_auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
        )
        firebase_admin_auth.set_custom_user_claims(record.uid, {"role": role})
        record = firebase_admin_auth.get_user(record.uid)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    claims = record.custom_claims or {}
    role_value = role_from_claims(claims)
    return UserSummary(
        uid=record.uid,
        email=record.email,
        display_name=record.display_name,
        role=role_value,
        permissions=permissions_for_role(role_value),
    )
