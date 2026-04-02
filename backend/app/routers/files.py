from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.db_models import EDIFile, ParseResult, ValidationErrorDB
from app.schemas import EDIFileResponse, ParseResultResponse, ValidationErrorResponse
from typing import List
import uuid

router = APIRouter()


@router.get("/files", response_model=List[EDIFileResponse])
async def list_files(skip: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EDIFile).offset(skip).limit(limit))
    files = result.scalars().all()
    return files


@router.get("/files/{file_id}", response_model=EDIFileResponse)
async def get_file(file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EDIFile).where(EDIFile.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.get("/files/{file_id}/parse-result", response_model=ParseResultResponse)
async def get_parse_result(file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParseResult).where(ParseResult.file_id == file_id))
    parse = result.scalar_one_or_none()
    if not parse:
        raise HTTPException(status_code=404, detail="Parse result not found")
    return parse


@router.get("/files/{file_id}/errors", response_model=List[ValidationErrorResponse])
async def get_validation_errors(file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ValidationErrorDB).where(ValidationErrorDB.file_id == file_id))
    errors = result.scalars().all()
    return errors
