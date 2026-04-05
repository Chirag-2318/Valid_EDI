from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_
from sqlalchemy import delete
from urllib.request import urlopen
from app.auth.firebase_auth import (
    UserContext,
    allowed_transaction_types,
    ensure_edit_for_transaction,
    ensure_view_for_transaction,
    get_current_user,
)
from app.database import get_db
from app.db_models import EDIFile, ParseResult, ValidationErrorDB
from app.schemas import EDIFileResponse, ParseResultResponse, ValidationErrorResponse
from app.services.edi_service import EDIService
from app.services.db_service import DBService, parse_interchange_date
from app.services.s3_service import S3Service
from app.parser.x12_parser import parse_x12
from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid

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


class RawUpdateRequest(BaseModel):
    content: str


@router.get("/files", response_model=List[EDIFileResponse])
async def list_files(
    skip: int = 0,
    limit: int = 1000,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    allowed_types = allowed_transaction_types(user)
    if not allowed_types:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(
        select(EDIFile)
        .where(func.lower(EDIFile.transaction_type).in_(allowed_types))
        .order_by(EDIFile.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
    )
    files = result.scalars().all()
    file_ids = [f.id for f in files]
    if file_ids:
        counts = await db.execute(
            select(ValidationErrorDB.file_id, ValidationErrorDB.severity, func.count())
            .where(ValidationErrorDB.file_id.in_(file_ids))
            .where(
                or_(
                    ValidationErrorDB.error_code.is_(None),
                    ~ValidationErrorDB.error_code.in_(SUPPRESSED_ERROR_CODES),
                )
            )
            .where(
                or_(
                    ValidationErrorDB.severity.is_(None),
                    func.lower(ValidationErrorDB.severity) != "warning",
                )
            )
            .group_by(ValidationErrorDB.file_id, ValidationErrorDB.severity)
        )
        count_map = {}
        for file_id, severity, count in counts.all():
            entry = count_map.setdefault(file_id, {"error": 0, "warning": 0})
            if str(severity or "error").lower() == "warning":
                entry["warning"] = count
            else:
                entry["error"] = count
        for f in files:
            counts_for_file = count_map.get(f.id, {"error": 0, "warning": 0})
            f.error_count = counts_for_file["error"]
            f.warning_count = 0
            f.is_valid = counts_for_file["error"] == 0
    return files


@router.get("/files/{file_id}", response_model=EDIFileResponse)
async def get_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    result = await db.execute(select(EDIFile).where(EDIFile.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file.transaction_type)
    return file


@router.get("/files/{file_id}/parse-result", response_model=ParseResultResponse)
async def get_parse_result(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == file_id))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file_row.transaction_type)
    result = await db.execute(select(ParseResult).where(ParseResult.file_id == file_id))
    parse = result.scalar_one_or_none()
    if not parse:
        raise HTTPException(status_code=404, detail="Parse result not found")
    return parse


@router.get("/files/{file_id}/errors", response_model=List[ValidationErrorResponse])
async def get_validation_errors(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == file_id))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file_row.transaction_type)
    result = await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == file_id))
    errors = result.scalars().all()
    return [
        e for e in errors
        if (e.error_code or "") not in SUPPRESSED_ERROR_CODES
        and (e.severity or "").lower() != "warning"
    ]


@router.get("/files/{file_id}/raw")
async def get_raw_edi(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == file_id))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file_row.transaction_type)
    parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == file_id))).scalar_one_or_none()
    if file_row.s3_key:
        try:
            raw_bytes = S3Service().get_file_bytes(file_row.s3_key)
            return Response(content=raw_bytes, media_type="text/plain")
        except Exception:
            pass
    raw_fallback = None
    if parse_row and isinstance(parse_row.raw_json, dict):
        raw_fallback = parse_row.raw_json.get("raw_edi")
    if raw_fallback:
        return Response(content=raw_fallback, media_type="text/plain")
    if file_row.s3_url:
        try:
            with urlopen(file_row.s3_url) as resp:
                if getattr(resp, "status", 200) == 200:
                    return Response(content=resp.read(), media_type="text/plain")
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Raw file not available")


@router.put("/files/{file_id}/raw", response_model=ParseResultResponse)
async def update_raw_edi(
    file_id: uuid.UUID,
    payload: RawUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    try:
        file_row = (await db.execute(select(EDIFile).where(EDIFile.id == file_id))).scalar_one_or_none()
        if not file_row:
            raise HTTPException(status_code=404, detail="File not found")
        ensure_edit_for_transaction(user, file_row.transaction_type)
        if not payload.content.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty")

        raw_bytes = payload.content.encode("utf-8")
        if file_row.s3_key:
            try:
                S3Service().put_file_bytes(file_row.s3_key, raw_bytes)
            except Exception:
                pass

        try:
            edi_data = EDIService().process_file(raw_bytes, file_row.original_filename or file_row.filename)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        file_row.transaction_type = edi_data.get("transaction_type")
        file_row.is_valid = edi_data.get("is_valid")
        file_row.error_count = edi_data.get("error_count")
        file_row.warning_count = edi_data.get("warning_count")

        parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == file_id))).scalar_one_or_none()
        if not parse_row:
            parse_row = ParseResult(file_id=file_id)
            db.add(parse_row)

        parse_row.transaction_set = edi_data.get("transaction_type")
        parse_row.sender_id = edi_data.get("sender_id")
        parse_row.receiver_id = edi_data.get("receiver_id")
        parse_row.interchange_date = parse_interchange_date(edi_data.get("interchange_date"))
        parse_row.segment_count = edi_data.get("segment_count")
        raw_json = dict(edi_data.get("raw_json") or {})
        raw_json["raw_edi"] = payload.content
        parse_row.raw_json = raw_json

        await db.execute(delete(ValidationErrorDB).where(ValidationErrorDB.file_id == file_id))
        await DBService().save_validation_errors(db=db, file_id=file_id, issues=edi_data.get("issues") or [])

        await db.commit()
        await db.refresh(parse_row)
        return parse_row
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Save failed: {exc}") from exc




@router.get("/claims/remittance-status")
async def get_claims_remittance_status(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """For every 837 file, determine remittance status by matching claim IDs against 835 files."""
    claim_rows = (await db.execute(
        select(EDIFile, ParseResult)
        .join(ParseResult, ParseResult.file_id == EDIFile.id, isouter=True)
        .where(func.lower(EDIFile.transaction_type).in_(["837p", "837i"]))
        .order_by(EDIFile.uploaded_at.desc())
    )).all()

    remit_rows = (await db.execute(
        select(EDIFile, ParseResult)
        .join(ParseResult, ParseResult.file_id == EDIFile.id, isouter=True)
        .where(func.lower(EDIFile.transaction_type) == "835")
    )).all()

    claim_to_835 = {}
    for remit_file, remit_parse in remit_rows:
        if not remit_parse or not remit_parse.raw_json:
            continue
        raw = remit_parse.raw_json
        sd = raw.get("structured_data")
        if isinstance(sd, dict):
            payments = sd.get("claims") or []
        elif isinstance(sd, list):
            payments = sd
        else:
            je = raw.get("json_export") or {}
            payments = je.get("claims") or []

        # Fallback: if claims are empty, re-parse from S3 using flat-walk extractor
        # (handles 835 files where 2100 loops sit directly under ROOT, no 2000 wrapper)
        if not payments and remit_file.s3_key:
            try:
                from app.services.s3_service import S3Service
                from validedi import parse as vparse
                from app.services.edi_service import _extract_835_claims_flat
                raw_bytes = S3Service().get_file_bytes(remit_file.s3_key)
                edi_result = vparse(raw_bytes.decode("utf-8", errors="ignore"))
                payments = _extract_835_claims_flat(edi_result)
                # Persist the fix so next call is fast
                if payments and remit_parse:
                    existing_sd = raw.get("structured_data") or {}
                    if isinstance(existing_sd, dict):
                        existing_sd["claims"] = payments
                    else:
                        existing_sd = {"claims": payments}
                    remit_parse.raw_json = {**raw, "structured_data": existing_sd}
                    db.add(remit_parse)
                    await db.commit()
            except Exception as _e:
                pass

        for payment in payments:
            if not isinstance(payment, dict):
                continue
            cid = (
                payment.get("patient_account")
                or payment.get("claim_id")
                or payment.get("patient_control_number")
                or ""
            )
            if not cid:
                continue
            entry = {
                "file_id": str(remit_file.id),
                "filename": remit_file.filename,
                "uploaded_at": remit_file.uploaded_at.isoformat() if remit_file.uploaded_at else None,
                "claim_id": cid,
                "billed": float(payment.get("total_charged") or payment.get("billed_amount") or payment.get("billed") or 0),
                "paid": float(payment.get("total_paid") or payment.get("paid_amount") or payment.get("paid") or 0),
                "patient_responsibility": float(payment.get("patient_responsibility") or 0),
                "adjustments": str(payment.get("adjustments") or ""),
                "status_code": str(payment.get("claim_status_code") or payment.get("status_code") or ""),
            }
            claim_to_835.setdefault(cid, []).append(entry)

    results = []
    for claim_file, claim_parse in claim_rows:
        raw = (claim_parse.raw_json if claim_parse else None) or {}
        sd = raw.get("structured_data")
        if isinstance(sd, list):
            structured = sd
        elif isinstance(sd, dict):
            structured = sd.get("claims") or []
        else:
            structured = []

        claim_ids = []
        for claim in structured:
            if not isinstance(claim, dict):
                continue
            cid = (
                claim.get("claim_id")
                or claim.get("patient_control_number")
                or claim.get("clm_01")
                or ""
            )
            if cid:
                claim_ids.append(cid)

        linked_835 = []
        for cid in claim_ids:
            linked_835.extend(claim_to_835.get(cid, []))

        seen = set()
        unique_835 = []
        for item in linked_835:
            if item["file_id"] not in seen:
                seen.add(item["file_id"])
                unique_835.append(item)

        is_remitted = len(unique_835) > 0
        total_paid = sum(p["paid"] for p in linked_835)
        total_billed_835 = sum(p["billed"] for p in linked_835)

        results.append({
            "file_id": str(claim_file.id),
            "filename": claim_file.filename,
            "transaction_type": claim_file.transaction_type,
            "uploaded_at": claim_file.uploaded_at.isoformat() if claim_file.uploaded_at else None,
            "is_remitted": is_remitted,
            "linked_835": unique_835,
            "total_paid": total_paid,
            "total_billed_835": total_billed_835,
            "claim_ids": claim_ids,
        })

    return results


# -- Activity Logs --------------------------------------------------------------

@router.get("/activity-logs")
async def get_activity_logs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    from app.db_models import ActivityLog
    result = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.user_id == user.uid)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "resource_name": log.resource_name,
            "ip_address": log.ip_address,
            "metadata": log.extra_data,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]

# -- NPI Validation via NPPES API -----------------------------------------------

@router.get("/npi/validate/{npi_number}")
async def validate_npi(
    npi_number: str,
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    """Validate an NPI number against the CMS NPPES API v2.1."""
    import httpx, os
    if not npi_number or not npi_number.isdigit() or len(npi_number) != 10:
        raise HTTPException(status_code=400, detail="NPI must be a 10-digit number")

    nppes_url = "https://npiregistry.cms.hhs.gov/api/"
    params = {"version": "2.1", "number": npi_number, "limit": 1}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(nppes_url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NPPES API error: {e}")

    results = data.get("results") or []
    if not results:
        return {"npi": npi_number, "found": False, "active": False, "name": None, "enumeration_type": None}

    provider = results[0]
    basic = provider.get("basic") or {}
    status = basic.get("status", "").upper()
    active = status == "A"

    # Build display name
    if provider.get("enumeration_type") == "NPI-1":
        name = " ".join(filter(None, [basic.get("first_name"), basic.get("last_name")])) or basic.get("organization_name")
    else:
        name = basic.get("organization_name") or basic.get("name")

    taxonomies = provider.get("taxonomies") or []
    primary_taxonomy = next((t.get("desc") for t in taxonomies if t.get("primary")), None)

    return {
        "npi": npi_number,
        "found": True,
        "active": active,
        "status": status,
        "name": name,
        "enumeration_type": provider.get("enumeration_type"),
        "primary_taxonomy": primary_taxonomy,
        "credential": basic.get("credential"),
    }


@router.get("/files/{file_id}/npi-status")
async def get_file_npi_status(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    """Extract NPIs from an 837 file and validate each against NPPES."""
    import httpx

    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == file_id))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file_row.transaction_type)

    parse_row = (await db.execute(select(ParseResult).where(ParseResult.file_id == file_id))).scalar_one_or_none()
    if not parse_row or not parse_row.raw_json:
        return {"file_id": str(file_id), "npis": []}

    sd = parse_row.raw_json.get("structured_data") or []
    claims = sd if isinstance(sd, list) else (sd.get("claims") or [])

    # Collect unique NPIs with provider names from billing_provider
    npi_map: dict[str, str] = {}
    for claim in claims:
        bp = claim.get("billing_provider") or {}
        npi = bp.get("npi") or ""
        name = bp.get("name") or ""
        if npi and npi.isdigit() and len(npi) == 10:
            npi_map[npi] = name

    if not npi_map:
        raw_edi = (parse_row.raw_json or {}).get("raw_edi") or ""
        if raw_edi:
            import re
            for match in re.finditer(r"NM1\*[^~]*?\*(\d{10})", raw_edi):
                npi_map.setdefault(match.group(1), "")

    if not npi_map:
        return {"file_id": str(file_id), "npis": []}

    nppes_url = "https://npiregistry.cms.hhs.gov/api/"
    results = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for npi, edi_name in npi_map.items():
            try:
                resp = await client.get(nppes_url, params={"version": "2.1", "number": npi, "limit": 1})
                resp.raise_for_status()
                data = resp.json()
                api_results = data.get("results") or []
                if not api_results:
                    results.append({"npi": npi, "edi_name": edi_name, "found": False, "active": False, "nppes_name": None})
                    continue
                provider = api_results[0]
                basic = provider.get("basic") or {}
                status = basic.get("status", "").upper()
                active = status == "A"
                if provider.get("enumeration_type") == "NPI-1":
                    nppes_name = " ".join(filter(None, [basic.get("first_name"), basic.get("last_name")])) or basic.get("organization_name")
                else:
                    nppes_name = basic.get("organization_name") or basic.get("name")
                taxonomies = provider.get("taxonomies") or []
                primary_taxonomy = next((t.get("desc") for t in taxonomies if t.get("primary")), None)
                results.append({
                    "npi": npi,
                    "edi_name": edi_name,
                    "found": True,
                    "active": active,
                    "status": status,
                    "nppes_name": nppes_name,
                    "primary_taxonomy": primary_taxonomy,
                })
            except Exception:
                results.append({"npi": npi, "edi_name": edi_name, "found": False, "active": False, "nppes_name": None, "error": "lookup_failed"})

    return {"file_id": str(file_id), "npis": results}


def _parse_date(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y%m%d")
    except ValueError:
        return None


def _build_member_name(last_name: str, first_name: str) -> str:
    parts = [p for p in [first_name, last_name] if p]
    return " ".join(parts)


def _extract_834_roster(segments) -> Dict[str, Dict[str, Any]]:
    roster: Dict[str, Dict[str, Any]] = {}
    current: Dict[str, Any] | None = None

    for seg in segments:
        if seg.id == "NM1" and len(seg.elements) > 8 and seg.elements[0] == "IL":
            member_id = seg.elements[8]
            current = {
                "member_id": member_id,
                "first_name": seg.elements[3] if len(seg.elements) > 3 else "",
                "last_name": seg.elements[2] if len(seg.elements) > 2 else "",
                "coverage_start": "",
                "coverage_end": "",
            }
            if member_id:
                roster[member_id] = current
            continue
        if seg.id == "DTP" and current and len(seg.elements) > 2:
            if seg.elements[0] == "348":
                current["coverage_start"] = seg.elements[2]
            elif seg.elements[0] == "349":
                current["coverage_end"] = seg.elements[2]

    return roster


def _extract_837_claims(segments) -> List[Dict[str, Any]]:
    claims: List[Dict[str, Any]] = []
    current_claim: Dict[str, Any] | None = None
    current_member_id = ""
    current_member_name = ""
    pending_claim_date = ""

    def finalize():
        nonlocal current_claim
        if current_claim and current_claim.get("claim_id"):
            claims.append(dict(current_claim))
        current_claim = None

    for seg in segments:
        if seg.id == "NM1" and len(seg.elements) > 8 and seg.elements[0] == "IL":
            current_member_id = seg.elements[8]
            first = seg.elements[3] if len(seg.elements) > 3 else ""
            last = seg.elements[2] if len(seg.elements) > 2 else ""
            current_member_name = _build_member_name(last, first)
            if current_claim and not current_claim.get("member_id"):
                current_claim["member_id"] = current_member_id
                current_claim["member_name"] = current_member_name
            continue
        if seg.id == "CLM" and seg.elements:
            finalize()
            current_claim = {
                "claim_id": seg.elements[0],
                "member_id": current_member_id,
                "member_name": current_member_name,
                "claim_date": pending_claim_date,
            }
            pending_claim_date = ""
            continue
        if seg.id == "DTP" and len(seg.elements) > 2 and seg.elements[0] in {"472", "434"}:
            if current_claim:
                current_claim["claim_date"] = current_claim.get("claim_date") or seg.elements[2]
            else:
                pending_claim_date = seg.elements[2]

    finalize()
    return claims


@router.get("/files/{file_id}/eligibility-status")
async def get_eligibility_status(
    file_id: uuid.UUID,
    enrollment_file_id: Optional[uuid.UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    """Compare 834 member roster (NM1*IL -> NM109) against 837 claims (NM1*IL -> NM109)."""
    file_row = (await db.execute(select(EDIFile).where(EDIFile.id == file_id))).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
    ensure_view_for_transaction(user, file_row.transaction_type)

    if enrollment_file_id:
        enroll_row = (await db.execute(select(EDIFile).where(EDIFile.id == enrollment_file_id))).scalar_one_or_none()
    else:
        enroll_row = (await db.execute(
            select(EDIFile)
            .where(func.lower(EDIFile.transaction_type) == "834")
            .order_by(EDIFile.uploaded_at.desc())
            .limit(1)
        )).scalar_one_or_none()

    if not enroll_row:
        return {"file_id": str(file_id), "enrollment_file_id": None, "members": []}

    ensure_view_for_transaction(user, enroll_row.transaction_type)

    def _load_raw(file_row, parse_row):
        if file_row.s3_key:
            try:
                return S3Service().get_file_bytes(file_row.s3_key).decode("utf-8", errors="ignore")
            except Exception:
                pass
        if parse_row and isinstance(parse_row.raw_json, dict):
            raw = parse_row.raw_json.get("raw_edi")
            if raw:
                return raw
        if file_row.s3_url:
            try:
                with urlopen(file_row.s3_url) as resp:
                    if getattr(resp, "status", 200) == 200:
                        return resp.read().decode("utf-8", errors="ignore")
            except Exception:
                pass
        return ""

    enroll_parse = (await db.execute(select(ParseResult).where(ParseResult.file_id == enroll_row.id))).scalar_one_or_none()
    claim_parse = (await db.execute(select(ParseResult).where(ParseResult.file_id == file_id))).scalar_one_or_none()

    enroll_raw = _load_raw(enroll_row, enroll_parse)
    claim_raw = _load_raw(file_row, claim_parse)

    if not enroll_raw or not claim_raw:
        return {
            "file_id": str(file_id),
            "enrollment_file_id": str(enroll_row.id),
            "enrollment_filename": enroll_row.filename,
            "members": [],
        }

    enroll_segments = parse_x12(enroll_raw).segments
    claim_segments = parse_x12(claim_raw).segments

    roster = _extract_834_roster(enroll_segments)
    claims = _extract_837_claims(claim_segments)

    results = []
    eligible = 0
    ineligible = 0
    unknown = 0
    not_found = 0

    for claim in claims:
        member_id = claim.get("member_id") or ""
        claim_date = _parse_date(claim.get("claim_date"))
        roster_entry = roster.get(member_id)
        status = "unknown"
        reason = "missing_dates"
        roster_name = ""

        if not roster_entry:
            status = "not_in_roster"
            reason = "no_match"
            not_found += 1
        else:
            roster_name = _build_member_name(roster_entry.get("last_name", ""), roster_entry.get("first_name", ""))
            start_date = _parse_date(roster_entry.get("coverage_start"))
            end_date = _parse_date(roster_entry.get("coverage_end"))
            if claim_date and start_date and claim_date < start_date:
                status = "not_effective"
                reason = "before_start"
                ineligible += 1
            elif claim_date and end_date and claim_date > end_date:
                status = "terminated"
                reason = "after_end"
                ineligible += 1
            elif claim_date and (start_date or end_date):
                status = "eligible"
                reason = "within_window"
                eligible += 1
            else:
                status = "unknown"
                reason = "missing_dates"
                unknown += 1

        results.append({
            "claim_id": claim.get("claim_id"),
            "member_id": member_id,
            "claim_member_name": claim.get("member_name"),
            "roster_member_name": roster_name,
            "claim_date": claim.get("claim_date"),
            "coverage_start": roster_entry.get("coverage_start") if roster_entry else "",
            "coverage_end": roster_entry.get("coverage_end") if roster_entry else "",
            "status": status,
            "reason": reason,
        })

    return {
        "file_id": str(file_id),
        "enrollment_file_id": str(enroll_row.id),
        "enrollment_filename": enroll_row.filename,
        "members": results,
        "summary": {
            "total_claims": len(results),
            "eligible": eligible,
            "ineligible": ineligible,
            "not_in_roster": not_found,
            "unknown": unknown,
        },
    }

