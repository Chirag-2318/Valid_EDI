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
                "You are an expert EDI healthcare claims analyst specializing in X12 HIPAA 5010 standards. "
                "You have been given structured data about a specific EDI file. "
                "Answer questions accurately and concisely based only on the provided file data. "
                "If the data does not contain the answer, say so clearly."
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
                max_tokens=512,
            ))
            return response.choices[0].message.content.strip()
        except Exception as e:
            # Fall through to rule-based
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
    sd = context.get("structured_data")
    q = question.lower()

    if any(w in q for w in ["sender", "receiver", "who sent", "who is the"]):
        return f"Sender ID: {sender} | Receiver ID: {receiver}."

    if any(w in q for w in ["transaction type", "what type", "transaction set", "what kind"]):
        type_map = {"837P": "Professional Health Care Claim", "837I": "Institutional Health Care Claim",
                    "835": "Health Care Claim Payment/Remittance Advice", "834": "Benefit Enrollment and Maintenance"}
        return f"This is a {tx} — {type_map.get(tx, tx)}."

    if any(w in q for w in ["valid", "invalid", "pass", "fail", "reject", "accept"]):
        if is_valid:
            return f"Yes, {filename} is valid with no errors."
        msgs = [e.get("error_message", "") for e in errors[:3] if e.get("error_message")]
        return f"No — {filename} has {error_count} error(s): {'; '.join(msgs)}."

    if any(w in q for w in ["segment", "loop", "how many", "count"]):
        return f"{filename} contains {seg_count} loop(s)."

    if any(w in q for w in ["procedure", "cpt", "hcpcs", "service code"]):
        if isinstance(sd, list) and sd:
            codes = [line.get("procedure_code") for c in sd for line in (c.get("service_lines") or []) if line.get("procedure_code")]
            if codes:
                return f"Procedure codes: {', '.join(set(codes))}."
        return "No procedure code data available."

    if any(w in q for w in ["patient", "member", "subscriber"]):
        if isinstance(sd, list) and sd:
            p = sd[0].get("patient") or {}
            return f"Patient: {p.get('first_name','')} {p.get('last_name','')} (Member ID: {p.get('member_id','N/A')})."
        return "No patient data available."

    if any(w in q for w in ["charge", "amount", "billed", "total", "cost"]):
        if isinstance(sd, list) and sd:
            total = sum(float(c.get("total_charge") or 0) for c in sd)
            return f"Total billed: ${total:,.2f}."
        return "No charge data available."

    if any(w in q for w in ["fix", "correct", "repair", "resolve"]):
        if errors:
            msgs = [e.get("error_message", "") for e in errors[:3] if e.get("error_message")]
            return f"{len(errors)} issue(s): {'; '.join(msgs)}. Use Fix Assistant to apply corrections."
        return "No errors — file does not need corrections."

    if any(w in q for w in ["diagnosis", "icd", "dx"]):
        if isinstance(sd, list) and sd:
            codes = [dx.get("code") for c in sd for dx in (c.get("diagnoses") or []) if dx.get("code")]
            if codes:
                return f"Diagnosis codes: {', '.join(set(codes))}."
        return "No diagnosis data available."

    if any(w in q for w in ["provider", "npi", "billing"]):
        if isinstance(sd, list) and sd:
            prov = sd[0].get("billing_provider") or {}
            return f"Billing Provider: {prov.get('name','N/A')} (NPI: {prov.get('npi','N/A')})."
        return "No provider data available."

    if any(w in q for w in ["date", "when"]):
        return f"Interchange date: {context.get('interchange_date', 'N/A')}."

    status = "valid" if is_valid else f"{error_count} error(s) found"
    return (
        f"{filename} is a {tx} | Sender: {sender} → Receiver: {receiver} | "
        f"Segments: {seg_count} | Status: {status}. "
        f"Ask about patient, procedure codes, charges, errors, or provider."
    )


