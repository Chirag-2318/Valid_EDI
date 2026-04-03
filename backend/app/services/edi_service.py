import os
import tempfile

from validedi import parse, validate, export_json, extract_claims, extract_payments, extract_enrollments
from validedi.llm import explain


class EDIService:
    def _parse_with_temp_file(self, file_bytes: bytes, original_filename: str):
        _, ext = os.path.splitext(original_filename)
        suffix = ext if ext else ".edi"
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
                handle.write(file_bytes)
                handle.flush()
                temp_path = handle.name
            return parse(temp_path)
        finally:
            if temp_path:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

    def process_file(self, file_bytes: bytes, original_filename: str) -> dict:
        try:
            content = file_bytes.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ValueError(f"Failed to decode EDI file '{original_filename}': {e}")

        try:
            # Parse once, then pass ParsedEDI to validate (NEW in v0.3.0)
            try:
                edi_result = parse(content)
            except OSError as e:
                # validedi may treat raw content as a file path; fall back to temp file
                if getattr(e, "errno", None) != 36:
                    raise
                edi_result = self._parse_with_temp_file(file_bytes, original_filename)
            val_result = validate(edi_result)  # Now accepts ParsedEDI object
        except Exception as e:
            raise ValueError(f"Failed to process EDI file '{original_filename}': {e}")

        # Generate plain English report (rule-based, no LLM needed)
        try:
            explanation = explain(edi_result, val_result, force_rule_based=True)
            human_report = explanation.report
        except Exception:
            human_report = "Could not generate explanation."

        envelope = edi_result.envelope
        errors = val_result.errors or []
        
        # NEW in v0.3.0: Extract structured data based on transaction type
        structured_data = None
        try:
            if envelope.transaction_type in ('837p', '837i'):
                structured_data = extract_claims(edi_result)
            elif envelope.transaction_type == '835':
                structured_data = extract_payments(edi_result)
            elif envelope.transaction_type == '834':
                structured_data = extract_enrollments(edi_result)
        except Exception as e:
            # If extraction fails, continue without structured data
            print(f"Warning: Could not extract structured data: {e}")
        
        # NEW in v0.3.1: export_json now returns dict (not string)
        json_export = None
        try:
            json_export = export_json(edi_result, val_result, include_raw=False)
        except Exception as e:
            print(f"Warning: Could not generate JSON export: {e}")

        return {
            "transaction_type": envelope.transaction_type,
            "sender_id": envelope.sender_id,
            "receiver_id": envelope.receiver_id,
            "interchange_date": envelope.interchange_date,
            "segment_count": len(edi_result.loops),
            "raw_json": {
                "report": human_report,
                "structured_data": structured_data,  # NEW: Extracted business data
                "json_export": json_export  # NEW: Full JSON export (now dict, not string)
            },
            "is_valid": val_result.is_valid,
            "error_count": val_result.error_count,
            "warning_count": val_result.warning_count,
            "issues": [e.model_dump() for e in errors],
        }
