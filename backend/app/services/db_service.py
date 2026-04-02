import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.db_models import EDIFile, ParseResult, ValidationErrorDB


def parse_interchange_date(date_str):
    if not date_str:
        return None
    try:
        s = str(date_str).strip()
        if len(s) == 6:
            return datetime.strptime(s, "%y%m%d").date()
        elif len(s) == 8:
            return datetime.strptime(s, "%Y%m%d").date()
    except ValueError:
        return None
    return None


class DBService:
    async def save_edi_file(self, db, filename, original_filename, s3_key, s3_url,
                            file_size, transaction_type, is_valid, error_count, warning_count) -> EDIFile:
        record = EDIFile(
            filename=filename, original_filename=original_filename,
            s3_key=s3_key, s3_url=s3_url, file_size=file_size,
            transaction_type=transaction_type, status="processed",
            is_valid=is_valid, error_count=error_count, warning_count=warning_count,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    async def save_parse_result(self, db, file_id: uuid.UUID, edi_data: dict) -> ParseResult:
        record = ParseResult(
            file_id=file_id,
            transaction_set=edi_data.get("transaction_type"),
            sender_id=edi_data.get("sender_id"),
            receiver_id=edi_data.get("receiver_id"),
            interchange_date=parse_interchange_date(edi_data.get("interchange_date")),
            segment_count=edi_data.get("segment_count"),
            raw_json=edi_data.get("raw_json"),
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    async def save_validation_errors(self, db, file_id: uuid.UUID, issues: list) -> None:
        for issue in issues:
            record = ValidationErrorDB(
                file_id=file_id,
                error_message=issue.get("message"),
                error_code=issue.get("code"),
                severity=issue.get("severity"),
                segment=issue.get("segment"),
                element_position=issue.get("position"),
                loop_id=issue.get("loop"),
                suggestion=None,
            )
            db.add(record)
        await db.commit()
