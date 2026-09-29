"""
Deterministic complaint analysis used only when the configured GenAI provider is
unavailable or returns an invalid result.

This is explicitly a Python rule-matrix fallback, not a fabricated GenAI result.
"""
from typing import Any, Dict, List, Optional
import re

from python_engine.rule_matrix import find_matching_rule, RULES
from python_engine.validate import _evaluate_escalation_conditions


def _sentiment(text: str) -> str:
    t = (text or "").lower()
    strong = ("furious", "outrage", "threat", "disgusted", "worst service", "unacceptable")
    negative = ("delay", "broken", "damaged", "refund", "wrong", "failed", "missing", "problem", "complaint")
    if any(x in t for x in strong):
        return "Strongly Negative"
    if any(x in t for x in negative):
        return "Negative"
    return "Neutral"


def _find_rule(complaint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = f"{complaint.get('title', '')} {complaint.get('description', '')}".strip()
    return find_matching_rule(category="", subcategory="", text=text, strict=True)


def _escalation(rule: Dict[str, Any], complaint: Dict[str, Any], text: str) -> tuple[bool, str]:
    matched = _evaluate_escalation_conditions(rule, complaint, text)
    if rule.get("mandatory_escalation"):
        return True, rule.get("escalation_reason") or "Mandatory escalation condition in the Rule Matrix"
    if matched:
        return True, matched[0]
    lower = text.lower()
    if any(x in lower for x in ("lawsuit", "attorney", "court", "legal action")):
        return True, "Customer legal representation threat"
    if any(x in lower for x in ("fire", "smoke", "swollen battery", "spark", "electric shock", "exploded")):
        return True, "Product safety hazard / physical risk"
    if complaint.get("prev_complaint_ref") or complaint.get("is_repeat") and int(complaint.get("repeat_count") or 0) >= 2:
        return True, "Repeated unresolved complaint"
    return False, ""


def build_deterministic_analysis(complaint: Dict[str, Any]) -> Dict[str, Any]:
    text = f"{complaint.get('title', '')} {complaint.get('description', '')}".strip()
    rule = _find_rule(complaint)

    if not rule:
        # Unknown/unconfigured cases must not be falsely classified as a known rule.
        # Customer Relations is a safe holding taxonomy; the record is forced to review.
        return {
            "primary_issue": complaint.get("title") or "Unclassified complaint",
            "secondary_issue": None,
            "issue_category": "Customer Relations",
            "subcategory": "General Inquiry",
            "sentiment": _sentiment(text),
            "urgency": "Medium",
            "priority": "P2",
            "department": "Customer Relations",
            "supporting_department": None,
            "policy_id": "CSR-POL-11",
            "policy_section": "1.0",
            "resolution_steps": ["Route to an authorized reviewer for classification"],
            "escalation_required": False,
            "escalation_level": "No Escalation",
            "escalation_notes": "No deterministic Rule Matrix match; manual classification required.",
            "professional_response": (
                "Dear Customer,\n\nThank you for contacting SupportNova. "
                "We have received your complaint and will review the details before confirming the appropriate resolution.\n\n"
                "SupportNova Care Team"
            ),
            "response_type": "Manual Review Acknowledgement",
            "follow_up_required": True,
            "follow_up_communication": "Follow up after classification and policy verification.",
            "agent_guidance": "Review the complaint against the configured Rule Matrix and active policy before making commitments.",
            "clarification_questions": None,
            "_fallback_manual_review": True,
        }

    esc, reason = _escalation(rule, complaint, text)
    level = "Critical Management Escalation" if esc and rule["category"] in {"Safety", "Privacy"} else (
        "Supervisor Review" if esc else "No Escalation"
    )
    required = list(rule.get("required_actions", []))
    response = (
        f"Dear Customer,\n\nThank you for contacting SupportNova regarding your {rule['subcategory'].lower()} concern. "
        f"We will review the case using the applicable {rule['policy_id']} policy and complete the required verification steps."
    )
    if esc:
        response += " The case has been flagged for the appropriate review."
    response += "\n\nSupportNova Care Team"

    return {
        "primary_issue": complaint.get("title") or rule["subcategory"],
        "secondary_issue": None,
        "issue_category": rule["category"],
        "subcategory": rule["subcategory"],
        "sentiment": _sentiment(text),
        "urgency": rule["default_urgency"],
        "priority": rule["default_priority"],
        "department": rule["department"],
        "supporting_department": None,
        "policy_id": rule["policy_id"],
        "policy_section": rule.get("policy_section", "1.0"),
        "resolution_steps": required,
        "escalation_required": esc,
        "escalation_level": level,
        "escalation_notes": reason or "No escalation required by current deterministic rules.",
        "professional_response": response,
        "response_type": "Rule-Matrix Grounded Resolution",
        "follow_up_required": True,
        "follow_up_communication": rule.get("follow_up") or "Follow up within the applicable SLA.",
        "agent_guidance": "Apply the required actions and prohibited-action checks from the matched Rule Matrix rule.",
        "clarification_questions": None,
        "_fallback_manual_review": False,
    }
