import uuid
from datetime import datetime, date
from sqlalchemy import String, Integer, Boolean, Text, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class EDIFile(Base):
    __tablename__ = "edi_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    is_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    parse_results: Mapped[list["ParseResult"]] = relationship(back_populates="edi_file", cascade="all, delete-orphan")
    validation_errors: Mapped[list["ValidationErrorDB"]] = relationship(back_populates="edi_file", cascade="all, delete-orphan")


class ParseResult(Base):
    __tablename__ = "parse_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("edi_files.id"), nullable=False)
    transaction_set: Mapped[str] = mapped_column(String(10), nullable=True)
    sender_id: Mapped[str] = mapped_column(String(50), nullable=True)
    receiver_id: Mapped[str] = mapped_column(String(50), nullable=True)
    interchange_date: Mapped[date] = mapped_column(Date, nullable=True)
    segment_count: Mapped[int] = mapped_column(Integer, nullable=True)
    parsed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    raw_json: Mapped[dict] = mapped_column(JSONB, nullable=True)

    edi_file: Mapped["EDIFile"] = relationship(back_populates="parse_results")


class ValidationErrorDB(Base):
    __tablename__ = "validation_errors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("edi_files.id"), nullable=False)
    segment: Mapped[str] = mapped_column(String(10), nullable=True)
    element_position: Mapped[int] = mapped_column(Integer, nullable=True)
    loop_id: Mapped[str] = mapped_column(String(20), nullable=True)
    error_code: Mapped[str] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=True)
    suggestion: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    edi_file: Mapped["EDIFile"] = relationship(back_populates="validation_errors")