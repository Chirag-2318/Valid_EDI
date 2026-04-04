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