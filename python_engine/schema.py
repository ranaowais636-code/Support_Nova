"""Deterministic validation for the GenAI structured complaint contract."""
from typing import Any, Dict, List

REQUIRED_FIELDS = {
    "primary_issue": str,
    "secondary_issue": (str, type(None)),
    "issue_category": str,
    "subcategory": str,
    "sentiment": str,
    "urgency": str,
    "priority": str,
    "department": str,
    "supporting_department": (str, type(None)),
    "policy_id": str,
    "policy_section": str,
    "resolution_steps": list,
    "escalation_required": bool,
    "escalation_level": str,
    "escalation_notes": str,
    "professional_response": str,
    "response_type": str,
    "follow_up_required": bool,
    "follow_up_communication": str,
    "agent_guidance": str,
    "clarification_questions": (str, type(None)),
}

ALLOWED_CATEGORIES = {"Delivery", "Billing", "Product Defect", "Refund", "Warranty", "Technical Support", "Returns", "Privacy", "Safety", "Customer Relations"}
ALLOWED_SENTIMENTS = {"Positive", "Neutral", "Negative", "Strongly Negative"}
ALLOWED_URGENCY = {"Low", "Medium", "High", "Critical"}
ALLOWED_PRIORITY = {"P0", "P1", "P2", "P3"}
ALLOWED_DEPARTMENTS = {"Logistics", "Billing", "Technical Support", "Returns", "Warranty", "Customer Relations", "Account Security", "Compliance", "Safety", "Management Escalations"}
ALLOWED_ESCALATION = {"No Escalation", "Supervisor Review", "Department Manager", "Specialist Team", "Compliance Review", "Critical Management Escalation"}


def validate_ai_output(payload: Any) -> List[str]:
    errors: List[str] = []
    if not isinstance(payload, dict):
        return ["GenAI output is not a JSON object."]

    missing = [key for key in REQUIRED_FIELDS if key not in payload]
    if missing:
        errors.append("Missing required fields: " + ", ".join(missing))

    unexpected = [key for key in payload if key not in REQUIRED_FIELDS]
    if unexpected:
        errors.append("Unexpected fields: " + ", ".join(unexpected))

    for key, expected in REQUIRED_FIELDS.items():
        if key not in payload:
            continue
        value = payload[key]
        if not isinstance(value, expected):
            errors.append(f"Field '{key}' has invalid type.")

    if isinstance(payload.get("resolution_steps"), list) and not all(isinstance(x, str) and x.strip() for x in payload["resolution_steps"]):
        errors.append("resolution_steps must contain non-empty strings only.")
    if payload.get("issue_category") not in ALLOWED_CATEGORIES:
        errors.append("issue_category is outside the approved taxonomy.")
    if payload.get("sentiment") not in ALLOWED_SENTIMENTS:
        errors.append("sentiment is outside the approved taxonomy.")
    if payload.get("urgency") not in ALLOWED_URGENCY:
        errors.append("urgency is outside the approved taxonomy.")
    if payload.get("priority") not in ALLOWED_PRIORITY:
        errors.append("priority is outside the approved taxonomy.")
    if payload.get("department") not in ALLOWED_DEPARTMENTS:
        errors.append("department is outside the approved taxonomy.")
    if payload.get("supporting_department") not in ALLOWED_DEPARTMENTS | {None}:
        errors.append("supporting_department is outside the approved taxonomy.")
    if payload.get("escalation_level") not in ALLOWED_ESCALATION:
        errors.append("escalation_level is outside the approved taxonomy.")
    if payload.get("priority") == "P0" and payload.get("urgency") != "Critical":
        errors.append("P0 complaints must use Critical urgency.")
    if payload.get("escalation_required") is True and payload.get("escalation_level") == "No Escalation":
        errors.append("escalation_required=true cannot use No Escalation.")
    if payload.get("escalation_required") is False and payload.get("escalation_level") != "No Escalation":
        errors.append("escalation_required=false must use No Escalation.")
    return errors
