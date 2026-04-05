from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from app.auth.firebase_auth import (
    ANY_VIEW_PERMISSIONS,
    UserContext,
    ensure_domains_view,
    ensure_upload_for_transaction,
    ensure_view_for_transaction,
    get_current_user,
    require_any_permissions,
)
from app.models import (
    BatchResult,
    ChatRequest,
    ChatResponse,
    DeltaRequest,
    EligibilityRequest,
    ParseRequest,
    ParsedFileReport,
    ReconcileRequest,
    UploadResponse,
)
from app.parser.x12_parser import parse_x12, to_segment_text
from app.services.chat import ask_huggingface
from app.services.exports import csv_bytes, error_report_pdf_bytes, json_bytes
from app.services.summaries import build_834_summary, build_835_summary, build_family_grouping
from app.validation.rules import validate
from app.database import get_db
from app.services.db_service import DBService
from app.services.s3_service import S3Service
from app.routers import admin, auth, upload, files, copilot

app = FastAPI(title="EdiPro Healthcare EDI Parser API", version="1.0.0")


# Allow Firebase Auth popups: GitHub Pages sets COOP same-origin by default which
# blocks window.closed / window.close calls used by signInWithPopup.
class COOPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["Cross-Origin-Opener-Policy"] = "unsafe-none"
        response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
        return response


app.add_middleware(COOPMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(copilot.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

STITCH_DIR = Path(__file__).resolve().parents[2] / "stitch"
if STITCH_DIR.exists():
    app.mount("/stitch", StaticFiles(directory=STITCH_DIR, html=True), name="stitch")


FRONTEND_URL = "https://edipro.me"


@app.get("/")
def frontend_home() -> RedirectResponse:
    return RedirectResponse(url=FRONTEND_URL, status_code=307)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/parse")
def parse_raw(request: ParseRequest, user: UserContext = Depends(get_current_user)) -> dict[str, Any]:
    parsed = parse_x12(request.content)
    if parsed.transaction_type != "UNKNOWN":
        ensure_view_for_transaction(user, parsed.transaction_type)
    validation = validate(parsed)
    return {
        "parse_result": parsed.model_dump(),
        "validation_result": validation.model_dump(),
    }


# NOTE: /api/upload is handled by upload.router (routers/upload.py) which
# persists files to S3 and PostgreSQL. Do not add a duplicate route here.


@app.post("/api/batch", response_model=BatchResult)
async def batch_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> BatchResult:
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a ZIP file for batch processing.")

    zip_bytes = await file.read()
    zip_buffer = io.BytesIO(zip_bytes)
    reports: list[ParsedFileReport] = []
    file_ids: list[str] = []

    db_service = DBService()
    s3_service = S3Service()

    with zipfile.ZipFile(zip_buffer) as zf:
        for name in zf.namelist():
            if not name.lower().endswith((".edi", ".txt", ".dat", ".x12")):
                continue
            raw_bytes = zf.read(name)
            data = raw_bytes.decode("utf-8", errors="ignore")
            parsed = parse_x12(data)
            ensure_upload_for_transaction(user, parsed.transaction_type)
            validation = validate(parsed)
            reports.append(
                ParsedFileReport(filename=name, parse_result=parsed, validation_result=validation)
            )
            try:
                s3_result = s3_service.upload_file(
                    file_bytes=raw_bytes,
                    filename=name,
                    content_type="application/octet-stream",
                )
                issues = [i.model_dump() for i in validation.issues]
                edi_data = {
                    "transaction_type": parsed.transaction_type,
                    "is_valid": validation.valid,
                    "error_count": sum(1 for i in validation.issues if i.severity == "error"),
                    "warning_count": sum(1 for i in validation.issues if i.severity == "warning"),
                    "issues": issues,
                    "sender_id": parsed.envelope.sender_id,
                    "receiver_id": parsed.envelope.receiver_id,
                    "interchange_date": parsed.envelope.interchange_date,
                    "segment_count": len(parsed.segments),
                    "raw_json": {"structured_data": []},
                }
                edi_file = await db_service.save_edi_file(
                    db=db,
                    filename=name,
                    original_filename=name,
                    s3_key=s3_result["s3_key"],
                    s3_url=s3_result["s3_url"],
                    file_size=len(raw_bytes),
                    transaction_type=edi_data["transaction_type"],
                    is_valid=edi_data["is_valid"],
                    error_count=edi_data["error_count"],
                    warning_count=edi_data["warning_count"],
                )
                await db_service.save_parse_result(db=db, file_id=edi_file.id, edi_data=edi_data)
                await db_service.save_validation_errors(db=db, file_id=edi_file.id, issues=issues)
                file_ids.append(str(edi_file.id))
            except Exception:
                file_ids.append("")

    failed = sum(1 for r in reports if not r.validation_result.valid)
    passed = len(reports) - failed

    return BatchResult(total_files=len(reports), passed=passed, failed=failed, reports=reports, file_ids=file_ids)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user: UserContext = Depends(get_current_user)) -> ChatResponse:
    answer = await ask_huggingface(request.question, request.context)
    return ChatResponse(answer=answer)


@app.post("/api/reconcile/835-837")
def reconcile_835_837(
    request: ReconcileRequest,
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_domains_view(user, "claims", "remittance")
    p837 = parse_x12(request.edi_837)
    p835 = parse_x12(request.edi_835)

    claims_837: dict[str, float] = {}
    for seg in p837.segments:
        if seg.id == "CLM" and len(seg.elements) > 1:
            claims_837[seg.elements[0]] = _to_float(seg.elements[1])

    claims_835: dict[str, dict[str, float]] = {}
    for seg in p835.segments:
        if seg.id == "CLP" and len(seg.elements) > 3:
            claims_835[seg.elements[0]] = {
                "billed": _to_float(seg.elements[2]),
                "paid": _to_float(seg.elements[3]),
            }

    rows = []
    for claim_id, billed_837 in claims_837.items():
        from_835 = claims_835.get(claim_id, {"billed": 0.0, "paid": 0.0})
        rows.append(
            {
                "claim_id": claim_id,
                "837_billed": billed_837,
                "835_billed": from_835["billed"],
                "835_paid": from_835["paid"],
                "variance": round(billed_837 - from_835["paid"], 2),
            }
        )

    return {"rows": rows, "matched": len([r for r in rows if r["835_paid"] > 0])}


@app.post("/api/delta/834")
def delta_834(
    request: DeltaRequest,
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_domains_view(user, "enrollment")
    old_summary = build_834_summary(parse_x12(request.old_834).segments)
    new_summary = build_834_summary(parse_x12(request.new_834).segments)

    old_map = {m.get("member_id", ""): m for m in old_summary if m.get("member_id")}
    new_map = {m.get("member_id", ""): m for m in new_summary if m.get("member_id")}

    added = [m for mid, m in new_map.items() if mid not in old_map]
    terminated = [m for mid, m in old_map.items() if mid not in new_map]

    changed = []
    for mid in set(old_map.keys()) & set(new_map.keys()):
        if old_map[mid] != new_map[mid]:
            changed.append({"member_id": mid, "from": old_map[mid], "to": new_map[mid]})

    return {"added": added, "terminated": terminated, "changed": changed}


@app.post("/api/eligibility/834-837")
def eligibility_check(
    request: EligibilityRequest,
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_domains_view(user, "enrollment", "claims")
    members = build_834_summary(parse_x12(request.edi_834).segments)
    member_ids = {m.get("member_id") for m in members if m.get("member_id")}

    parsed_837 = parse_x12(request.edi_837)
    claims: list[dict[str, str]] = []
    current_claim = ""

    for seg in parsed_837.segments:
        if seg.id == "CLM" and seg.elements:
            current_claim = seg.elements[0]
        if seg.id == "REF" and len(seg.elements) > 1 and seg.elements[0] in {"SY", "1W", "Y4"}:
            claims.append({"claim_id": current_claim, "member_id": seg.elements[1]})

    ineligible = [c for c in claims if c["member_id"] not in member_ids]
    return {"total_claims_with_member_ref": len(claims), "ineligible_claims": ineligible}


@app.post("/api/export/json")
def export_json(
    payload: dict[str, Any],
    user: UserContext = Depends(require_any_permissions(*ANY_VIEW_PERMISSIONS)),
) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(json_bytes(payload)),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=parsed.json"},
    )


@app.post("/api/export/errors-pdf")
def export_errors_pdf(
    payload: dict[str, Any],
    user: UserContext = Depends(require_any_permissions(*ANY_VIEW_PERMISSIONS)),
) -> StreamingResponse:
    issues = payload.get("issues", [])
    return StreamingResponse(
        io.BytesIO(error_report_pdf_bytes(issues)),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=validation-report.pdf"},
    )


@app.post("/api/export/members-csv")
def export_members_csv(
    payload: dict[str, Any],
    user: UserContext = Depends(require_any_permissions(*ANY_VIEW_PERMISSIONS)),
) -> StreamingResponse:
    rows = payload.get("rows", [])
    return StreamingResponse(
        io.BytesIO(csv_bytes(rows)),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=members.csv"},
    )


@app.post("/api/export/corrected-edi")
def export_corrected_edi(
    payload: dict[str, Any],
    user: UserContext = Depends(require_any_permissions(*ANY_VIEW_PERMISSIONS)),
) -> StreamingResponse:
    segments = payload.get("segments", [])
    try:
        text = to_segment_text([_segment_from_dict(s) for s in segments])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid segment payload: {exc}")

    return StreamingResponse(
        io.BytesIO(text.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=corrected.edi"},
    )


@app.post("/api/834/family-grouping")
def family_grouping(
    payload: dict[str, Any],
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_domains_view(user, "enrollment")
    rows = payload.get("rows", [])
    return {"groups": build_family_grouping(rows)}


def _segment_from_dict(data: dict[str, Any]) -> Any:
    from app.models import Segment
    return Segment(
        id=data.get("id", ""),
        elements=list(data.get("elements", [])),
        line_number=int(data.get("line_number", 0)),
    )


def _to_float(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return 0.0




@app.get("/api/export/summary-pdf/{file_id}")
async def export_summary_pdf(
    file_id: str,
    user: UserContext = Depends(get_current_user),
) -> StreamingResponse:
    from uuid import UUID
    from sqlalchemy import select as sa_select
    from app.database import get_db as _get_db
    from app.db_models import EDIFile, ParseResult, ValidationErrorDB
    from app.auth.firebase_auth import ensure_view_for_transaction
    from app.services.pdf_report import build_audit_pdf
    import io as _io
    fid = UUID(file_id)
    async for db in _get_db():
        file_row = (await db.execute(sa_select(EDIFile).where(EDIFile.id == fid))).scalar_one_or_none()
        if not file_row:
            raise HTTPException(status_code=404, detail="File not found")
        ensure_view_for_transaction(user, file_row.transaction_type)
        parse_row = (await db.execute(sa_select(ParseResult).where(ParseResult.file_id == fid))).scalar_one_or_none()
        errors = (await db.execute(sa_select(ValidationErrorDB).where(ValidationErrorDB.file_id == fid))).scalars().all()
        break
    pdf_bytes = build_audit_pdf(file_row, parse_row, list(errors))
    safe_name = file_row.filename.replace(" ", "_").replace("/", "_")
    return StreamingResponse(
        _io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_name}-audit.pdf"},
    )

