import os
import tempfile

from validedi import parse, validate, export_json, extract_claims, extract_payments, extract_enrollments
from validedi.llm import explain

SUPPRESSED_ERROR_CODES = {"DIAGNOSIS_CODE_FORMAT", "CHARGE_TOTAL_CHECK", "AMOUNT_FORMAT"}


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
        issues = [e.model_dump() for e in errors]
        filtered_issues = [
            i for i in issues
            if i.get("code") not in SUPPRESSED_ERROR_CODES and i.get("severity") != "warning"
        ]
        error_count = len(filtered_issues)
        warning_count = 0
        is_valid = error_count == 0
        
        # NEW in v0.3.0: Extract structured data based on transaction type
        structured_data = None
        try:
            if envelope.transaction_type in ('837p', '837i'):
                structured_data = extract_claims(edi_result)
            elif envelope.transaction_type == '835':
                structured_data = extract_payments(edi_result)
                # Fallback: some 835 files have 2100 loops directly under ROOT (no 2000 wrapper).
                # If extract_payments returned no claims, walk all loops for 2100 directly.
                if isinstance(structured_data, dict) and not structured_data.get("claims"):
                    structured_data["claims"] = _extract_835_claims_flat(edi_result)
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
                "json_export": json_export,  # NEW: Full JSON export (now dict, not string)
                "raw_edi": content,
            },
            "is_valid": is_valid,
            "error_count": error_count,
            "warning_count": warning_count,
            "issues": filtered_issues,
        }

def _extract_835_claims_flat(edi_result) -> list:
    """
    Fallback extractor for 835 files where CLP/2100 loops sit directly under ROOT
    instead of being nested inside a 2000 loop. Walks all loops at any depth.
    """
    claims = []

    def walk(loops):
        for loop in loops:
            lid = getattr(loop, 'loop_id', None)
            if lid == '2100':
                clp = loop.find_segment('CLP') if hasattr(loop, 'find_segment') else None
                if clp:
                    try:
                        patient_account = clp.get_value(1)
                        claim_status = clp.get_value(2)
                        total_charged = float(clp.get_value(3) or 0)
                        total_paid = float(clp.get_value(4) or 0)
                        patient_resp = float(clp.get_value(5) or 0)
                    except Exception:
                        patient_account = None
                        claim_status = None
                        total_charged = 0.0
                        total_paid = 0.0
                        patient_resp = 0.0

                    if patient_account:
                        claims.append({
                            "patient_account": patient_account,
                            "claim_status_code": claim_status,
                            "total_charged": total_charged,
                            "total_paid": total_paid,
                            "patient_responsibility": patient_resp,
                        })
            if hasattr(loop, 'children') and loop.children:
                walk(loop.children)

    walk(edi_result.loops)
    return claims
