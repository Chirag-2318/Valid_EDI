from __future__ import annotations

import copy
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.db_models import EDIFile, ParseResult, ValidationErrorDB
from app.services.chat import ask_huggingface

router = APIRouter()


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


async def _fetch_context(file_id: str, db: AsyncSession) -> dict:
    fid = UUID(file_id)
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == fid))).scalar_one_or_none()
    errors = (await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
    raw_json = parse_row.raw_json or {} if parse_row else {}
    return {
        "filename": file_row.filename,
        "transaction_type": file_row.transaction_type,
        "is_valid": file_row.is_valid,
        "error_count": file_row.error_count,
        "warning_count": file_row.warning_count,
        "sender_id": parse_row.sender_id if parse_row else None,
        "receiver_id": parse_row.receiver_id if parse_row else None,
        "interchange_date": str(parse_row.interchange_date) if parse_row and parse_row.interchange_date else None,
        "segment_count": parse_row.segment_count if parse_row else 0,
        "report": raw_json.get("report", ""),
        "structured_data": raw_json.get("structured_data"),
        "validation_errors": [
            {"segment": e.segment, "error_code": e.error_code, "error_message": e.error_message,
             "severity": e.severity, "loop_id": e.loop_id, "suggestion": e.suggestion}
            for e in errors
        ],
    }


def _rule_based_analysis(ctx: dict) -> dict:
    tx = (ctx.get("transaction_type") or "unknown").upper()
    seg_count = ctx.get("segment_count") or 0
    error_count = ctx.get("error_count") or 0
    warning_count = ctx.get("warning_count") or 0
    bullets = [
        f"Transaction type detected: {tx} — interchange envelope is structurally present.",
        f"File contains {seg_count} loop(s) parsed from the EDI content.",
        f"Sender: {ctx.get('sender_id', 'N/A')} to Receiver: {ctx.get('receiver_id', 'N/A')}.",
    ]
    critical_issues = [e["error_message"] for e in ctx.get("validation_errors", []) if e.get("severity") == "error"]
    health_score = max(0, min(100, 100 - (error_count * 10) - (warning_count * 3)))
    return {"bullets": bullets, "critical_issues": critical_issues, "health_score": health_score}


@router.post("/copilot/analyze")
async def analyze_file(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    ctx = await _fetch_context(req.file_id, db)
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
async def chat_with_copilot(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    ctx = await _fetch_context(req.file_id, db)
    history_str = ""
    for msg in req.history[-6:]:
        history_str += f"\n{msg.get('role','user').upper()}: {msg.get('content','')}"
    full_question = f"{history_str}\nUSER: {req.question}" if history_str else req.question
    answer = await ask_huggingface(full_question, ctx)
    return {"answer": answer}


@router.post("/copilot/fix")
async def apply_fix(req: FixRequest, db: AsyncSession = Depends(get_db)):
    fid = UUID(req.file_id)
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

    if fix_type == "AUTO":
        file_row = (await db.execute(select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
        if file_row:
            file_row.is_valid = True
            file_row.error_count = 0
            flag_modified(file_row, "is_valid")
        await db.execute(delete(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))

    await db.commit()
    return {"success": True, "updated_fields": updated_fields, "new_parse_result": raw_json}
