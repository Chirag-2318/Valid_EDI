import uuid
from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


class EDIFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    original_filename: str
    s3_url: str
    transaction_type: Optional[str]
    status: str
    is_valid: bool
    error_count: int
    warning_count: int
    uploaded_at: datetime


class ParseResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_id: uuid.UUID
    transaction_set: Optional[str]
    sender_id: Optional[str]
    receiver_id: Optional[str]
    interchange_date: Optional[date]
    segment_count: Optional[int]
    parsed_at: datetime
    raw_json: Optional[dict[str, Any]]


class ValidationErrorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_id: uuid.UUID
    segment: Optional[str]
    element_position: Optional[int]
    loop_id: Optional[str]
    error_code: Optional[str]
    error_message: Optional[str]
    severity: Optional[str]
    suggestion: Optional[str]


class ValidationSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: uuid.UUID
    is_valid: bool
    error_count: int
    warning_count: int
    errors: list[ValidationErrorResponse]
