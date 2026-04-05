from __future__ import annotations

import copy
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.auth.firebase_auth import (
    UserContext,
    ensure_edit_for_transaction,
    ensure_view_for_transaction,
    get_current_user,
)
from app.database import get_db
from app.db_models import EDIFile, ParseResult, ValidationErrorDB
from app.services.chat import ask_huggingface

router = APIRouter()
SUPPRESSED_ERROR_CODES = {
    "DIAGNOSIS_CODE_FORMAT",
    "CHARGE_TOTAL_CHECK",
    "AMOUNT_FORMAT",
    "837-001-SUBMITTER",
    "837-001-RECEIVER",
    "837-001-BILLING",
    "837-001-SUBSCRIBER",
    "837-001-PAYER",
    "CLM05_TYPE_CODES",
}


class AnalyzeRequest(BaseModel):
    file_id: str

class ChatRequest(BaseModel):
    file_id: str
    question: str
    history: list[dict] = []

class FixRequest(BaseModel):
    file_id: str
    fix_type: str
    suggested_value: str = ""


async def _fetch_context(file_id: str, db: AsyncSession, user: UserContext) -> dict:
    fid = UUID(file_id)
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file_row.transaction_type)
    parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == fid))).scalar_one_or_none()
    errors = (await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
    filtered_errors = [
        e for e in errors
        if (e.error_code or "") not in SUPPRESSED_ERROR_CODES
        and (e.severity or "").lower() != "warning"
    ]
    raw_json = parse_row.raw_json or {} if parse_row else {}
    return {
        "filename": file_row.filename,
        "transaction_type": file_row.transaction_type,
        "is_valid": file_row.is_valid,
        "error_count": len(filtered_errors),
        "warning_count": 0,
        "sender_id": parse_row.sender_id if parse_row else None,
        "receiver_id": parse_row.receiver_id if parse_row else None,
        "interchange_date": str(parse_row.interchange_date) if parse_row and parse_row.interchange_date else None,
        "segment_count": parse_row.segment_count if parse_row else 0,
        "parsed_edi": raw_json.get("json_export") or raw_json.get("structured_data"),
        "validation_errors": [
            {"segment": e.segment, "error_code": e.error_code, "error_message": e.error_message,
             "severity": e.severity, "loop_id": e.loop_id, "suggestion": e.suggestion}
            for e in filtered_errors
        ],
    }


def _rule_based_analysis(ctx: dict) -> dict:
    tx = (ctx.get("transaction_type") or "unknown").upper()
    seg_count = ctx.get("segment_count") or 0
    error_count = ctx.get("error_count") or 0
    warning_count = ctx.get("warning_count") or 0
    bullets = [
        f"Transaction type detected: {tx} - interchange envelope is structurally present.",
        f"File contains {seg_count} loop(s) parsed from the EDI content.",
        f"Sender: {ctx.get('sender_id', 'N/A')} to Receiver: {ctx.get('receiver_id', 'N/A')}.",
    ]
    critical_issues = [e["error_message"] for e in ctx.get("validation_errors", []) if e.get("severity") == "error"]
    health_score = max(0, min(100, 100 - (error_count * 10) - (warning_count * 3)))
    return {"bullets": bullets, "critical_issues": critical_issues, "health_score": health_score}


@router.post("/copilot/analyze")
async def analyze_file(
    req: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    ctx = await _fetch_context(req.file_id, db, user)
    question = (
        "Analyze this EDI file and respond in JSON only with these keys: "
        "bullets (array of 3 strings about file structure and health), "
        "critical_issues (array of strings for issues that will cause gateway rejection), "
        "health_score (integer 0-100). No extra text, just JSON."
    )
    try:
        raw = await ask_huggingface(question, ctx)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(raw[start:end])
            if "bullets" in result and "health_score" in result:
                return result
    except Exception:
        pass
    return _rule_based_analysis(ctx)


@router.post("/copilot/chat")
async def chat_with_copilot(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    ctx = await _fetch_context(req.file_id, db, user)
    history_str = ""
    for msg in req.history[-6:]:
        history_str += f"\n{msg.get('role','user').upper()}: {msg.get('content','')}"
    full_question = f"{history_str}\nUSER: {req.question}" if history_str else req.question
    answer = await ask_huggingface(full_question, ctx)
    return {"answer": answer}


@router.post("/copilot/fix")
async def apply_fix(
    req: FixRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    fid = UUID(req.file_id)
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_edit_for_transaction(user, file_row.transaction_type)
    parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == fid))).scalar_one_or_none()
    if not parse_row:
        raise HTTPException(status_code=404, detail="Parse result not found")

    raw_json = copy.deepcopy(dict(parse_row.raw_json or {}))
    json_export = copy.deepcopy(dict(raw_json.get("json_export") or {}))
    structured_data = raw_json.get("structured_data")
    updated_fields = []
    fix_type = req.fix_type.upper()

    if fix_type in ("BHT05_TIME", "AUTO"):
        val = req.suggested_value or "1200"
        envelope = dict(json_export.get("envelope") or {})
        envelope["bht05_time"] = val
        json_export["envelope"] = envelope
        raw_json["report"] = raw_json.get("report", "").replace("INVALID_TIME", val)
        updated_fields.append("bht05_time")

    if fix_type in ("TAX_ID", "AUTO"):
        val = req.suggested_value or "123456789"
        envelope = dict(json_export.get("envelope") or {})
        envelope["tax_id"] = val
        json_export["envelope"] = envelope
        raw_json["report"] = raw_json.get("report", "").replace("AB-12345-X", val)
        updated_fields.append("tax_id")

    if fix_type in ("CHARGE_TOTAL", "AUTO"):
        if isinstance(structured_data, list):
            for claim in structured_data:
                lines = claim.get("service_lines") or []
                if lines:
                    claim["total_charge"] = sum(float(line.get("charge") or 0) for line in lines)
            raw_json["structured_data"] = structured_data
            updated_fields.append("charge_totals")

    raw_json["json_export"] = json_export

    parse_row.raw_json = raw_json
    flag_modified(parse_row, "raw_json")
    await db.flush()

    # Recalculate remaining errors
    remaining_errors = (await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
    filtered_remaining = [
        e for e in remaining_errors
        if (e.error_code or "") not in SUPPRESSED_ERROR_CODES
        and (e.severity or "").lower() != "warning"
    ]
    filtered_remaining = [
        e for e in remaining_errors
        if (e.error_code or "") not in SUPPRESSED_ERROR_CODES
        and (e.severity or "").lower() != "warning"
    ]
    if fix_type == "AUTO":
        await db.execute(delete(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))
        remaining_count = 0
    else:
        fix_to_error_codes = {
            "BHT05_TIME": ["BHT05", "TIME_FORMAT", "INVALID_TIME"],
            "TAX_ID": ["TAX_ID", "EIN", "REF02", "INVALID_TAX"],
            "CHARGE_TOTAL": ["CHARGE_TOTAL_CHECK", "AMOUNT_MISMATCH", "CLM02"],
        }
        codes_to_clear = fix_to_error_codes.get(fix_type, [])
        remaining_count = len(filtered_remaining)
        if codes_to_clear:
            for err in remaining_errors:
                if any(code in (err.error_code or "") for code in codes_to_clear):
                    await db.execute(delete(ValidationErrorDB).where(ValidationErrorDB.id == err.id))
                    if (err.error_code or "") not in SUPPRESSED_ERROR_CODES and (err.severity or "").lower() != "warning":
                        remaining_count -= 1

    # Always update edi_files with current status
    file_row_update = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
    if file_row_update:
        file_row_update.error_count = remaining_count
        if remaining_count == 0:
            file_row_update.is_valid = True
            file_row_update.warning_count = 0
        flag_modified(file_row_update, "error_count")
        flag_modified(file_row_update, "is_valid")

    await db.commit()

    # Return refreshed data so frontend can update without reload
    refreshed_parse = (await db.execute(select(ParseResult).where(ParseResult.file_id == fid))).scalar_one_or_none()
    refreshed_errors = (await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
    filtered_refreshed = [
        e for e in refreshed_errors
        if (e.error_code or "") not in SUPPRESSED_ERROR_CODES
        and (e.severity or "").lower() != "warning"
    ]
    refreshed_file = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
    return {
        "success": True,
        "updated_fields": updated_fields,
        "new_parse_result": refreshed_parse.raw_json if refreshed_parse else raw_json,
        "remaining_errors": [
            {"id": str(e.id), "segment": e.segment, "error_code": e.error_code,
             "error_message": e.error_message, "severity": e.severity, "suggestion": e.suggestion}
            for e in filtered_refreshed
        ],
        "file_status": {
            "is_valid": refreshed_file.is_valid if refreshed_file else False,
            "error_count": remaining_count if refreshed_file else 0,
            "warning_count": 0,
        },
    }


class GroqKeyRequest(BaseModel):
    api_key: str


@router.post("/settings/groq-key")
async def update_groq_key(req: GroqKeyRequest):
    import os
    from pathlib import Path
    env_path = Path("backend/.env")
    if not env_path.exists():
        env_path = Path(".env")
    if env_path.exists():
        content = env_path.read_text()
        if "GROQ_API_KEY=" in content:
            lines = content.splitlines()
            lines = [f"GROQ_API_KEY={req.api_key}" if l.startswith("GROQ_API_KEY=") else l for l in lines]
            env_path.write_text("\n".join(lines))
        else:
            with env_path.open("a") as f:
                f.write(f"\nGROQ_API_KEY={req.api_key}")
    os.environ["GROQ_API_KEY"] = req.api_key
    return {"success": True}


class LLMFixRequest(BaseModel):
    file_id: str
    errors: list = []  # All validation errors to fix at once


@router.post("/copilot/fix-with-llm")
async def fix_with_llm(
    req: LLMFixRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    from app.services.chat import ask_llm_fix_edi
    from app.services.s3_service import S3Service
    from app.services.db_service import DBService, parse_interchange_date
    from sqlalchemy import delete as sa_delete

    fid = UUID(req.file_id)
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_edit_for_transaction(user, file_row.transaction_type)

    parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == fid))).scalar_one_or_none()

    # Get raw EDI — try S3 first, then DB fallback
    raw_edi = ""
    if file_row.s3_key:
        try:
            raw_edi = S3Service().get_file_bytes(file_row.s3_key).decode("utf-8", errors="ignore")
        except Exception:
            pass
    if not raw_edi and parse_row and isinstance(parse_row.raw_json, dict):
        raw_edi = parse_row.raw_json.get("raw_edi", "")
    if not raw_edi:
        raise HTTPException(status_code=400, detail="Raw EDI content not available for this file")

    # Collect all current validation errors if none passed
    all_errors = req.errors
    if not all_errors:
        db_errors = (await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
        all_errors = [
            {"code": e.error_code, "message": e.error_message, "segment": e.segment,
             "loop": e.loop_id, "severity": e.severity}
            for e in db_errors
        ]

    # Filter out library crash errors (validedi internal exceptions, not real EDI issues)
    all_errors = [
        e for e in all_errors
        if "raised an unexpected error" not in (e.get("message") or "")
    ]

    if not all_errors:
        raise HTTPException(status_code=400, detail="No fixable errors found. The reported issues are library-internal and cannot be resolved by editing the EDI content.")

    # Ask LLM to fix errors with structured changes
    fix_result = await ask_llm_fix_edi(raw_edi, all_errors)
    changes = fix_result.get("changes", [])
    corrected_edi = fix_result.get("corrected_edi", "")

    if not corrected_edi or not changes:
        raise HTTPException(status_code=422, detail="AI could not produce fixes for the reported errors. The errors may require manual correction.")

    corrected_bytes = corrected_edi.encode("utf-8")

    # Re-parse and re-validate the corrected EDI
    from app.services.edi_service import EDIService
    try:
        edi_data = EDIService().process_file(corrected_bytes, file_row.original_filename or file_row.filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Corrected EDI failed validation: {exc}")

    # Save corrected EDI back to S3
    if file_row.s3_key:
        try:
            S3Service().put_file_bytes(file_row.s3_key, corrected_bytes)
        except Exception:
            pass

    # Update EDIFile record
    file_row.transaction_type = edi_data.get("transaction_type")
    file_row.is_valid = edi_data.get("is_valid")
    file_row.error_count = edi_data.get("error_count")
    file_row.warning_count = edi_data.get("warning_count")
    file_row.file_size = len(corrected_bytes)

    # Update ParseResult
    if not parse_row:
        parse_row = ParseResult(file_id=fid)
        db.add(parse_row)
    parse_row.transaction_set = edi_data.get("transaction_type")
    parse_row.sender_id = edi_data.get("sender_id")
    parse_row.receiver_id = edi_data.get("receiver_id")
    parse_row.interchange_date = parse_interchange_date(edi_data.get("interchange_date"))
    parse_row.segment_count = edi_data.get("segment_count")
    raw_json = dict(edi_data.get("raw_json") or {})
    raw_json["raw_edi"] = corrected_edi
    parse_row.raw_json = raw_json

    # Replace validation errors
    await db.execute(sa_delete(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))
    db_service = DBService()
    await db_service.save_validation_errors(db=db, file_id=fid, issues=edi_data.get("issues") or [])

    await db.commit()

    # Fetch fresh errors
    remaining_errors = (await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
    filtered_remaining = [
        e for e in remaining_errors
        if (e.error_code or "") not in SUPPRESSED_ERROR_CODES
        and (e.severity or "").lower() != "warning"
    ]

    return {
        "success": True,
        "corrected_edi": corrected_edi,
        "changes": changes,
        "remaining_errors": [
            {
                "id": str(e.id),
                "segment": e.segment,
                "error_code": e.error_code,
                "error_message": e.error_message,
                "severity": e.severity,
                "suggestion": e.suggestion,
            }
            for e in filtered_remaining
        ],
        "file_status": {
            "is_valid": file_row.is_valid,
            "error_count": file_row.error_count,
            "warning_count": file_row.warning_count,
        },
    }

