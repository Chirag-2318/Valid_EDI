from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy import delete
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
from typing import List
import uuid

router = APIRouter()


class RawUpdateRequest(BaseModel):
    content: str


@router.get("/files", response_model=List[EDIFileResponse])
async def list_files(
    skip: int = 0,
    limit: int = 100,
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
    return errors


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
