"""
Custom Validation Rules — CRUD API + toggle + bulk delete (rollback).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.firebase_auth import UserContext, get_current_user
from app.database import get_db
from app.db_models import CustomValidationRule

router = APIRouter()

VALID_CONDITION_TYPES = {
    "element_not_empty",
    "element_equals",
    "element_not_equals",
    "element_matches_regex",
    "element_length",
    "element_min_length",
}


# ── Request / Response schemas ────────────────────────────────────────────────

class RuleCreate(BaseModel):
    name: str
    description: str = ""
    segment: str
    condition_type: str
    element_position: int = 1
    expected_value: str | None = None
    severity: str = "error"
    transaction_types: list[str] | None = None


class RuleResponse(BaseModel):
    id: str
    name: str
    description: str | None
    segment: str
    condition_type: str
    element_position: int
    expected_value: str | None
    severity: str
    transaction_types: list[str] | None
    enabled: bool
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/custom-rules")
async def list_rules(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    result = await db.execute(
        select(CustomValidationRule).order_by(CustomValidationRule.created_at.desc())
    )
    rules = result.scalars().all()
    return [_to_dict(r) for r in rules]


@router.post("/custom-rules")
async def create_rule(
    payload: RuleCreate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    # Validate
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Rule name is required")
    if not payload.segment.strip():
        raise HTTPException(status_code=400, detail="Segment is required")
    if payload.condition_type not in VALID_CONDITION_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid condition_type. Must be one of: {', '.join(sorted(VALID_CONDITION_TYPES))}")
    if payload.severity not in ("error", "warning"):
        raise HTTPException(status_code=400, detail="Severity must be 'error' or 'warning'")
    if payload.element_position < 1:
        raise HTTPException(status_code=400, detail="Element position must be >= 1")
    # Condition types that need expected_value
    needs_value = {"element_equals", "element_not_equals", "element_matches_regex", "element_length", "element_min_length"}
    if payload.condition_type in needs_value and not (payload.expected_value or "").strip():
        raise HTTPException(status_code=400, detail=f"expected_value is required for condition_type '{payload.condition_type}'")

    rule = CustomValidationRule(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        segment=payload.segment.strip().upper(),
        condition_type=payload.condition_type,
        element_position=payload.element_position,
        expected_value=payload.expected_value.strip() if payload.expected_value else None,
        severity=payload.severity,
        transaction_types=payload.transaction_types if payload.transaction_types else None,
        enabled=True,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _to_dict(rule)


@router.delete("/custom-rules/{rule_id}")
async def delete_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    rid = uuid.UUID(rule_id)
    result = await db.execute(select(CustomValidationRule).where(CustomValidationRule.id == rid))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
    return {"success": True, "deleted_id": rule_id}


@router.put("/custom-rules/{rule_id}/toggle")
async def toggle_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    rid = uuid.UUID(rule_id)
    result = await db.execute(select(CustomValidationRule).where(CustomValidationRule.id == rid))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.enabled = not rule.enabled
    rule.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(rule)
    return _to_dict(rule)


@router.delete("/custom-rules")
async def delete_all_rules(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    result = await db.execute(select(CustomValidationRule))
    count = len(result.scalars().all())
    await db.execute(delete(CustomValidationRule))
    await db.commit()
    return {"success": True, "deleted_count": count}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_dict(rule: CustomValidationRule) -> dict:
    return {
        "id": str(rule.id),
        "name": rule.name,
        "description": rule.description,
        "segment": rule.segment,
        "condition_type": rule.condition_type,
        "element_position": rule.element_position,
        "expected_value": rule.expected_value,
        "severity": rule.severity,
        "transaction_types": rule.transaction_types,
        "enabled": rule.enabled,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }
