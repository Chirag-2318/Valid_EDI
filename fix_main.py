import re

with open('backend/app/main.py', 'r') as f:
    content = f.read()

# Fix mangled import line
content = content.replace(
    "from app.database import get_db`nfrom app.services.db_service import DBService`nfrom app.services.s3_service import S3Service`nfrom app.routers import admin, auth, upload, files, copilot",
    "from app.database import get_db\nfrom app.services.db_service import DBService\nfrom app.services.s3_service import S3Service\nfrom app.routers import admin, auth, upload, files, copilot"
)

# Add AsyncSession import if not present
if 'from sqlalchemy.ext.asyncio import AsyncSession' not in content:
    content = content.replace(
        'from fastapi import Depends, FastAPI, File, HTTPException, UploadFile',
        'from fastapi import Depends, FastAPI, File, HTTPException, UploadFile\nfrom sqlalchemy.ext.asyncio import AsyncSession'
    )

# Replace batch_upload function
old_batch = '''@app.post("/api/batch", response_model=BatchResult)
async def batch_upload(
    file: UploadFile = File(...),
    user: UserContext = Depends(get_current_user),
) -> BatchResult:
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a ZIP file for batch processing.")

    content = await file.read()
    zip_buffer = io.BytesIO(content)
    reports: list[ParsedFileReport] = []

    with zipfile.ZipFile(zip_buffer) as zf:
        for name in zf.namelist():
            if not name.lower().endswith((".edi", ".txt", ".dat", ".x12")):
                continue
            data = zf.read(name).decode("utf-8", errors="ignore")
            parsed = parse_x12(data)
            ensure_upload_for_transaction(user, parsed.transaction_type)
            validation = validate(parsed)
            reports.append(
                ParsedFileReport(filename=name, parse_result=parsed, validation_result=validation)
            )

    failed = sum(1 for r in reports if not r.validation_result.valid)
    passed = len(reports) - failed

    return BatchResult(total_files=len(reports), passed=passed, failed=failed, reports=reports)'''

new_batch = '''@app.post("/api/batch", response_model=BatchResult)
async def batch_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
) -> BatchResult:
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a ZIP file for batch processing.")

    content = await file.read()
    zip_buffer = io.BytesIO(content)
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
            # Save each extracted file to DB and S3
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

    return BatchResult(
        total_files=len(reports),
        passed=passed,
        failed=failed,
        reports=reports,
        file_ids=file_ids,
    )'''

if old_batch in content:
    content = content.replace(old_batch, new_batch)
    print("batch_upload replaced")
else:
    print("ERROR: old_batch not found in content")

with open('backend/app/main.py', 'w') as f:
    f.write(content)

print("done")
