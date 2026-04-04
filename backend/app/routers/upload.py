from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.firebase_auth import UserContext, ensure_upload_for_transaction, get_current_user
from app.database import get_db
from app.schemas import EDIFileResponse
from app.services.db_service import DBService
from app.services.edi_service import EDIService
from app.services.s3_service import S3Service

router = APIRouter()


@router.post("/upload", response_model=EDIFileResponse)
async def upload_edi(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    try:
        file_bytes = await file.read()
        original_filename = file.filename or "upload.edi"

        # Parse and validate
        edi_data = EDIService().process_file(file_bytes, original_filename)

        ensure_upload_for_transaction(user, edi_data.get("transaction_type"))

        # Upload to S3
        s3_result = S3Service().upload_file(
            file_bytes=file_bytes,
            filename=original_filename,
            content_type=file.content_type or "application/octet-stream",
        )

        # Save file record to DB
        db_service = DBService()
        edi_file = await db_service.save_edi_file(
            db=db,
            filename=original_filename,
            original_filename=original_filename,
            s3_key=s3_result["s3_key"],
            s3_url=s3_result["s3_url"],
            file_size=len(file_bytes),
            transaction_type=edi_data["transaction_type"],
            is_valid=edi_data["is_valid"],
            error_count=edi_data["error_count"],
            warning_count=edi_data["warning_count"],
        )

        # Save parse result
        await db_service.save_parse_result(db=db, file_id=edi_file.id, edi_data=edi_data)

        # Save validation errors
        await db_service.save_validation_errors(db=db, file_id=edi_file.id, issues=edi_data["issues"])

        # Write activity log
        try:
            from app.db_models import ActivityLog
            log = ActivityLog(
                user_id=user.uid,
                action="file_upload",
                resource_type="edi_file",
                resource_id=edi_file.id,
                resource_name=original_filename,
                extra_data={
                    "transaction_type": edi_data.get("transaction_type"),
                    "is_valid": edi_data.get("is_valid"),
                    "error_count": edi_data.get("error_count"),
                    "file_size": len(file_bytes),
                },
            )
            db.add(log)
            await db.commit()
        except Exception:
            pass

        return EDIFileResponse.model_validate(edi_file)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
