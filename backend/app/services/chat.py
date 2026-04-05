from __future__ import annotations

import json
import os

GROQ_MODEL = "llama-3.3-70b-versatile"


async def ask_huggingface(question: str, context: dict) -> str:
    """Ask Groq LLM. Falls back to rule-based if key missing or call fails."""
    token = os.getenv("GROQ_API_KEY", "")

    if token:
        try:
            from groq import Groq
            import asyncio
            client = Groq(api_key=token)
            system_prompt = (
                "You are an expert EDI healthcare claims analyst specializing in X12 HIPAA 5010 standards.\n"
                "You have been given structured JSON data about a specific EDI file.\n\n"
                "RESPONSE FORMATTING RULES:\n"
                "- Always structure your response with clear sections using markdown.\n"
                "- Use **bold** for labels and key terms.\n"
                "- Use bullet points (- item) for lists of values, errors, or codes.\n"
                "- Use newlines between sections to keep things readable.\n"
                "- For analysis responses, use this structure:\n"
                "  ### Summary\n"
                "  <one sentence overview>\n\n"
                "  ### Details\n"
                "  - **Field**: value\n\n"
                "  ### Issues (if any)\n"
                "  - issue description\n\n"
                "  ### Recommendation\n"
                "  <actionable next step>\n"
                "- For simple factual questions, still use **bold labels** and newlines but keep it short.\n"
                "- Never return a wall of plain text. Always break it up.\n"
                "- Answer based only on the provided file data. If data is missing, say so clearly."
            )
            user_prompt = (
                f"EDI File Data:\n{json.dumps(context, indent=2, default=str)}\n\n"
                f"Question: {question}"
            )
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=768,
            ))
            return response.choices[0].message.content.strip()
        except Exception:
            pass

    return _rule_based_fallback(question, context)


def _rule_based_fallback(question: str, context: dict) -> str:
    tx = (context.get("transaction_type") or "unknown").upper()
    error_count = context.get("error_count") or 0
    is_valid = context.get("is_valid", False)
    errors = context.get("validation_errors") or []
    sender = context.get("sender_id", "N/A")
    receiver = context.get("receiver_id", "N/A")
    seg_count = context.get("segment_count") or 0
    filename = context.get("filename", "this file")
    sd = context.get("parsed_edi") or context.get("structured_data")
    q = question.lower()

    if any(w in q for w in ["sender", "receiver", "who sent", "who is the"]):
        return f"**Sender ID:** {sender}\n**Receiver ID:** {receiver}"

    if any(w in q for w in ["transaction type", "what type", "transaction set", "what kind"]):
        type_map = {
            "837P": "Professional Health Care Claim",
            "837I": "Institutional Health Care Claim",
            "835": "Health Care Claim Payment/Remittance Advice",
            "834": "Benefit Enrollment and Maintenance",
        }
        return f"**Transaction Type:** {tx}\n**Description:** {type_map.get(tx, tx)}"

    if any(w in q for w in ["valid", "invalid", "pass", "fail", "reject", "accept"]):
        if is_valid:
            return f"**Status:** Valid\n\n{filename} passed all validation checks with no errors."
        msgs = [e.get("error_message", "") for e in errors[:3] if e.get("error_message")]
        bullet_errors = "\n".join(f"- {m}" for m in msgs)
        return f"**Status:** Invalid\n**Errors ({error_count}):**\n{bullet_errors}"

    if any(w in q for w in ["segment", "loop", "how many", "count"]):
        return f"**Segment/Loop Count:** {seg_count}\n\n{filename} contains {seg_count} parsed loop(s)."

    if any(w in q for w in ["procedure", "cpt", "hcpcs", "service code"]):
        if isinstance(sd, list) and sd:
            codes = [line.get("procedure_code") for c in sd for line in (c.get("service_lines") or []) if line.get("procedure_code")]
            if codes:
                bullet_codes = "\n".join(f"- {c}" for c in set(codes))
                return f"**Procedure Codes:**\n{bullet_codes}"
        return "**Procedure Codes:** No procedure code data available."

    if any(w in q for w in ["patient", "member", "subscriber"]):
        if isinstance(sd, list) and sd:
            p = sd[0].get("patient") or {}
            return (
                f"**Patient Name:** {p.get('first_name', '')} {p.get('last_name', '')}\n"
                f"**Member ID:** {p.get('member_id', 'N/A')}"
            )
        return "**Member Info:** No patient data available."

    if any(w in q for w in ["charge", "amount", "billed", "total", "cost"]):
        if isinstance(sd, list) and sd:
            total = sum(float(c.get("total_charge") or 0) for c in sd)
            return f"**Total Billed:** ${total:,.2f}"
        return "**Charges:** No charge data available."

    if any(w in q for w in ["fix", "correct", "repair", "resolve"]):
        if errors:
            msgs = [e.get("error_message", "") for e in errors[:3] if e.get("error_message")]
            bullet_errors = "\n".join(f"- {m}" for m in msgs)
            return f"**Issues Found ({len(errors)}):**\n{bullet_errors}\n\n**Next Step:** Use the Fix Assistant to apply corrections."
        return "**Status:** No errors found. File does not need corrections."

    if any(w in q for w in ["diagnosis", "icd", "dx"]):
        if isinstance(sd, list) and sd:
            codes = [dx.get("code") for c in sd for dx in (c.get("diagnoses") or []) if dx.get("code")]
            if codes:
                bullet_codes = "\n".join(f"- {c}" for c in set(codes))
                return f"**Diagnosis Codes:**\n{bullet_codes}"
        return "**Diagnosis Codes:** No diagnosis data available."

    if any(w in q for w in ["provider", "npi", "billing"]):
        if isinstance(sd, list) and sd:
            prov = sd[0].get("billing_provider") or {}
            return (
                f"**Billing Provider:** {prov.get('name', 'N/A')}\n"
                f"**NPI:** {prov.get('npi', 'N/A')}"
            )
        return "**Provider Info:** No provider data available."

    if any(w in q for w in ["date", "when"]):
        return f"**Interchange Date:** {context.get('interchange_date', 'N/A')}"

    status = "Valid" if is_valid else f"{error_count} error(s) found"
    return (
        f"**File:** {filename}\n"
        f"**Type:** {tx}\n"
        f"**Sender:** {sender}  **Receiver:** {receiver}\n"
        f"**Segments:** {seg_count}\n"
        f"**Status:** {status}\n\n"
        f"Ask about members, procedure codes, charges, errors, or provider details."
    )

async def ask_llm_fix_edi(raw_edi: str, errors: list) -> dict:
    """Send raw EDI + validation errors to Groq. Returns structured changes dict.
    """
    token = os.getenv("GROQ_API_KEY", "")
    if not token:
        return {"changes": [], "corrected_edi": ""}
    try:
        from groq import Groq
        import asyncio
        client = Groq(api_key=token)
        system_prompt = (
            "You are an expert X12 HIPAA 5010 EDI editor.\n"
            "Given a raw EDI file and validation errors, return a strict JSON object with segment-level fixes.\n\n"
            "OUTPUT FORMAT (JSON only):\n"
            '{"changes": [\n'
            '  {"original_line": "EXACT segment text to replace", "corrected_line": "fixed segment text", '
            '"error_code": "ERROR_CODE", "explanation": "brief reason"}\n'
            "]}\n\n"
            "CRITICAL RULES:\n"
            "1. ONLY valid JSON, nothing else.\n"
            "2. 'original_line' MUST perfectly match a substring in the raw EDI.\n"
            "3. You must NOT add new unrequested segments, or drop required segments.\n"
            "4. NEVER include line breaks (\\n) in 'corrected_line' unless they were exactly in 'original_line'.\n"
            "5. BOTH 'original_line' and 'corrected_line' MUST END WITH THE EXACT SAME SEGMENT TERMINATOR (usually ~).\n"
            "6. For invalid NPI: replace with valid 10-digit NPI (e.g. 1234567893).\n"
            "7. For invalid codes (e.g. J20.9): remove the decimal (J209).\n"
            "8. For amount format errors: ensure plain numbers (e.g. 150.00).\n"
            "9. For charge total mismatches (SV1 vs CLM): ensure the SV1 line item charge (SV102) correctly matches the CLM total. NEVER add extra asterisks inside SV1 (e.g., use SV1*HC:99213*150.00*UN..., NOT SV1*HC:99213**150.00).\n"
            "10. For DIAGNOSIS_CODE_FORMAT: if the code already has no decimals and looks valid (e.g., J069), DO NOT modify it. The validator might be overly strict.\n"
        )
        errors_text = json.dumps(errors, indent=2)
        user_prompt = f"VALIDATION ERRORS:\n{errors_text}\n\nRAW EDI FILE:\n{raw_edi}"
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=4096,
        ))
        result = response.choices[0].message.content.strip()
        # Parse JSON
        if "```" in result:
            lines = result.splitlines()
            result = "\n".join(l for l in lines if not l.startswith("```")).strip()
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(result[start:end])
            changes = parsed.get("changes", [])
            
            validated_changes = []
            corrected_edi = raw_edi
            
            for change in changes:
                orig = change.get("original_line", "").strip()
                corrected = change.get("corrected_line", "").strip()
                if not orig or not corrected or orig == corrected:
                    continue
                
                # Check exact match. If it perfectly matches without whitespace manipulation:
                if orig in corrected_edi:
                    # Enforce terminator retention:
                    if orig.endswith("~") and not corrected.endswith("~"):
                        corrected += "~"
                    corrected_edi = corrected_edi.replace(orig, corrected, 1)
                    validated_changes.append({
                        "original_line": orig,
                        "corrected_line": corrected,
                        "error_code": change.get("error_code", ""),
                        "explanation": change.get("explanation", ""),
                    })
                else:
                    # Fallback: maybe LLM stripped trailing spaces/newlines
                    # Try finding by removing standard terminators to find the core segment
                    core_orig = orig.strip("~\r\n ")
                    core_corr = corrected.strip("~\r\n ")
                    if core_orig and core_corr and core_orig in corrected_edi:
                        parts = corrected_edi.split(core_orig, 1)
                        if len(parts) == 2:
                            corrected_edi = parts[0] + core_corr + parts[1]
                            validated_changes.append({
                                "original_line": core_orig,
                                "corrected_line": core_corr,
                                "error_code": change.get("error_code", ""),
                                "explanation": change.get("explanation", ""),
                            })

            return {"changes": validated_changes, "corrected_edi": corrected_edi}
        return {"changes": [], "corrected_edi": ""}
    except Exception:
        return {"changes": [], "corrected_edi": ""}

