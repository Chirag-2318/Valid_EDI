from __future__ import annotations

import json
import os
from typing import Iterable

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

load_dotenv()

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"admin.full"},
    "auditor": {"claims.view", "enrollment.view", "remittance.view"},
    "claims_creator": {"claims.view", "claims.write"},
    "claims_submitter": {"claims.view", "claims.submit"},
    "enrollment_manager": {"enrollment.view", "enrollment.write"},
    "payment_processor": {"remittance.view", "remittance.process"},
}

ROLE_OPTIONS = sorted(ROLE_PERMISSIONS.keys())

DOMAIN_VIEW_PERMISSIONS: dict[str, set[str]] = {
    "claims": {"claims.view", "claims.write", "claims.submit"},
    "enrollment": {"enrollment.view", "enrollment.write"},
    "remittance": {"remittance.view", "remittance.process"},
}

DOMAIN_UPLOAD_PERMISSIONS: dict[str, set[str]] = {
    "claims": {"claims.write", "claims.submit"},
    "enrollment": {"enrollment.write"},
    "remittance": {"remittance.process"},
}

DOMAIN_TRANSACTION_TYPES: dict[str, set[str]] = {
    "claims": {"837p", "837i"},
    "enrollment": {"834"},
    "remittance": {"835"},
}

ALL_PERMISSIONS = sorted(
    {perm for perms in ROLE_PERMISSIONS.values() for perm in perms if perm != "admin.full"}
)
ANY_VIEW_PERMISSIONS = sorted({perm for perms in DOMAIN_VIEW_PERMISSIONS.values() for perm in perms})


class UserContext(BaseModel):
    uid: str
    email: str | None = None
    display_name: str | None = None
    role: str | None = None
    permissions: list[str] = Field(default_factory=list)


BOOTSTRAP_ADMIN_EMAILS = {
    email.strip().lower()
    for email in os.getenv("RBAC_BOOTSTRAP_ADMIN_EMAILS", "").split(",")
    if email.strip()
}


def _normalize_role(role: str | None) -> str | None:
    if not role:
        return None
    return role.strip().lower().replace(" ", "_")


def normalize_role(role: str | None) -> str | None:
    return _normalize_role(role)


def permissions_for_role(role: str | None) -> list[str]:
    normalized = _normalize_role(role)
    perms = ROLE_PERMISSIONS.get(normalized or "", set())
    if "admin.full" in perms:
        return sorted(set(ALL_PERMISSIONS) | {"admin.full"})
    return sorted(perms)


def _load_firebase_credentials() -> credentials.Base:
    service_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    service_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()

    if service_json:
        try:
            data = json.loads(service_json)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Invalid FIREBASE_SERVICE_ACCOUNT_JSON") from exc
        return credentials.Certificate(data)

    if service_path:
        return credentials.Certificate(service_path)

    raise RuntimeError("Firebase service account is not configured")


def _ensure_firebase_app() -> None:
    if firebase_admin._apps:
        return
    cred = _load_firebase_credentials()
    firebase_admin.initialize_app(cred)


def _role_from_claims(claims: dict) -> str | None:
    role = claims.get("role")
    if not role:
        roles = claims.get("roles")
        if isinstance(roles, list) and roles:
            role = roles[0]
    return _normalize_role(role)


def role_from_claims(claims: dict) -> str | None:
    return _role_from_claims(claims)


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials_data: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserContext:
    if credentials_data is None or not credentials_data.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    _ensure_firebase_app()
    token = credentials_data.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    role = _role_from_claims(decoded)
    email = decoded.get("email")
    if not role and email and email.lower() in BOOTSTRAP_ADMIN_EMAILS:
        role = "admin"
    permissions = permissions_for_role(role)

    return UserContext(
        uid=str(decoded.get("uid", "")),
        email=email,
        display_name=decoded.get("name") or decoded.get("display_name"),
        role=role,
        permissions=permissions,
    )


def has_any_permission(user: UserContext, required: Iterable[str]) -> bool:
    if "admin.full" in user.permissions:
        return True
    return any(permission in user.permissions for permission in required)


def ensure_any_permission(user: UserContext, required: Iterable[str]) -> None:
    if not has_any_permission(user, required):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def require_any_permissions(*required: str):
    def dependency(user: UserContext = Depends(get_current_user)) -> UserContext:
        ensure_any_permission(user, required)
        return user

    return dependency


def domain_for_transaction_type(tx_type: str | None) -> str | None:
    if not tx_type:
        return None
    tx = str(tx_type).upper()
    if tx.startswith("837"):
        return "claims"
    if tx == "834":
        return "enrollment"
    if tx == "835":
        return "remittance"
    return None


def ensure_view_for_transaction(user: UserContext, tx_type: str | None) -> None:
    domain = domain_for_transaction_type(tx_type)
    if not domain:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported transaction type")
    required = DOMAIN_VIEW_PERMISSIONS.get(domain, set())
    ensure_any_permission(user, required)


def ensure_domain_view(user: UserContext, domain: str) -> None:
    required = DOMAIN_VIEW_PERMISSIONS.get(domain)
    if not required:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown permission domain")
    ensure_any_permission(user, required)


def ensure_domains_view(user: UserContext, *domains: str) -> None:
    for domain in domains:
        ensure_domain_view(user, domain)


def ensure_upload_for_transaction(user: UserContext, tx_type: str | None) -> None:
    domain = domain_for_transaction_type(tx_type)
    if not domain:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported transaction type")
    required = DOMAIN_UPLOAD_PERMISSIONS.get(domain, set())
    ensure_any_permission(user, required)


def ensure_edit_for_transaction(user: UserContext, tx_type: str | None) -> None:
    ensure_upload_for_transaction(user, tx_type)


def allowed_transaction_types(user: UserContext) -> set[str]:
    if "admin.full" in user.permissions:
        return {tx for types in DOMAIN_TRANSACTION_TYPES.values() for tx in types}

    allowed_domains = [
        domain
        for domain, perms in DOMAIN_VIEW_PERMISSIONS.items()
        if has_any_permission(user, perms)
    ]

    allowed: set[str] = set()
    for domain in allowed_domains:
        allowed.update(DOMAIN_TRANSACTION_TYPES.get(domain, set()))

    return allowed
