"""
SupportNova Ground-Truth Complaint Validation Pipeline & Comparison Engine
Independent Python rule-based engine that evaluates GenAI outputs against the
Rule Matrix and approved policies.
"""
from typing import Dict, Any, List, Tuple
import os
import sqlite3
import re
from python_engine.rule_matrix import find_matching_rule, RULES

# Valid departments and policies in SupportNova
VALID_DEPARTMENTS = [
    "Logistics", "Billing", "Technical Support", "Returns",
    "Warranty", "Customer Relations", "Account Security",
    "Compliance", "Safety", "Management Escalations"
]

ACTIVE_POLICIES = {
    "DEL-POL-04": {"title": "Delivery & Logistics Policy", "status": "Active", "version": "v2.1", "dept": "Logistics"},
    "BIL-POL-02": {"title": "Billing & Payment Disputes Policy", "status": "Active", "version": "v1.4", "dept": "Billing"},
    "REF-POL-01": {"title": "Refund & Return Terms", "status": "Active", "version": "v3.0", "dept": "Returns"},
    "WAR-POL-03": {"title": "Hardware Warranty & Coverage", "status": "Active", "version": "v2.0", "dept": "Warranty"},
    "REP-POL-05": {"title": "Product Replacement Procedures", "status": "Active", "version": "v1.2", "dept": "Returns"},
    "PRV-POL-06": {"title": "Customer Data & Privacy Policy", "status": "Active", "version": "v2.0", "dept": "Compliance"},
    "SAF-SOP-10": {"title": "Product Safety & Hazardous Incident SOP", "status": "Active", "version": "v1.0", "dept": "Safety"},
    "ESC-POL-07": {"title": "Enterprise Escalation & Executive Review", "status": "Active", "version": "v2.5", "dept": "Management Escalations"},
    "TEC-SOP-09": {"title": "Technical Diagnostic & Troubleshooting SOP", "status": "Active", "version": "v1.1", "dept": "Technical Support"},
    "CSR-POL-11": {"title": "Customer Service Conduct & Quality Standard", "status": "Active", "version": "v1.0", "dept": "Customer Relations"}
}

OUTDATED_POLICIES = {
    "REF-POL-OLD": {"title": "Obsolete 2021 Refund Policy", "status": "Outdated", "version": "v1.0"},
    "DEL-POL-OLD": {"title": "Legacy 2022 Courier SLA", "status": "Superseded", "version": "v1.0"}
}

def _policy_registry() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """Read current policy metadata from the KB; fall back to the bundled registry."""
    active = dict(ACTIVE_POLICIES)
    outdated = dict(OUTDATED_POLICIES)
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supportnova.db")
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, title, version, status, effective_date, doc_type FROM documents"
        ).fetchall()
        conn.close()
        for row in rows:
            item = dict(row)
            policy_id = str(item.get("id") or "").strip()
            if not policy_id:
                continue
            status = str(item.get("status") or "").strip()
            target = active if status.lower() == "active" else outdated
            target[policy_id] = {
                "title": item.get("title") or policy_id,
                "status": status or "Unknown",
                "version": item.get("version") or "",
                "effective_date": item.get("effective_date") or "",
                "doc_type": item.get("doc_type") or "",
            }
            if target is active:
                outdated.pop(policy_id, None)
            else:
                active.pop(policy_id, None)
    except Exception:
        pass
    return active, outdated

def _evaluate_escalation_conditions(rule: Dict[str, Any], complaint: Dict[str, Any], complaint_text: str) -> List[str]:
    """Evaluate the Rule Matrix escalation conditions deterministically.

    Conditions are stored as configuration in the independent Python matrix.
    This evaluator intentionally uses only complaint/customer fields and text;
    it never asks GenAI whether an escalation should happen.
    """
    import re

    text = complaint_text.lower()
    customer_type = str(complaint.get("customer_type", "")).lower()
    repeat_count = int(complaint.get("repeat_count") or 0)
    matched: List[str] = []

    def amount_values() -> List[float]:
        values = []
        for raw in re.findall(r"(?:\$|usd\s*)\s*(\d+(?:[.,]\d+)?)", text, re.I):
            try:
                values.append(float(raw.replace(",", "")))
            except ValueError:
                pass
        for key in ("amount", "dispute_amount", "transaction_amount", "order_amount"):
            try:
                if complaint.get(key) is not None:
                    values.append(float(complaint[key]))
            except (TypeError, ValueError):
                pass
        return values

    amounts = amount_values()
    for condition in rule.get("escalation_conditions", []):
        c = str(condition).lower().strip()
        hit = False

        if c == "repeat unresolved case":
            hit = bool(complaint.get("is_repeat") or complaint.get("prev_complaint_ref") or "unresolved" in text or "repeated" in text)
        elif c == "vip customer":
            hit = customer_type == "vip"
        elif "amount or impact threshold" in c:
            hit = any(term in text for term in ("critical", "severe impact", "major impact", "high impact"))
        elif re.search(r"(?:amount|value|price|dispute amount|duplicate amount)\s*>\s*\$?([0-9]+(?:\.[0-9]+)?)", c):
            threshold = float(re.search(r"(?:amount|value|price|dispute amount|duplicate amount)\s*>\s*\$?([0-9]+(?:\.[0-9]+)?)", c).group(1))
            hit = any(v > threshold for v in amounts)
        elif re.search(r"delay\s*>\s*(\d+)\s*days", c):
            days = int(re.search(r"delay\s*>\s*(\d+)\s*days", c).group(1))
            hit = bool(re.search(rf"(?:delay|late|overdue|waiting).*?{days}\s*days?", text)) or bool(re.search(rf"(?:{days + 1}|{days + 2}|{days + 3}|[0-9]{{2,}})\s*days?", text))
        elif "third claim in 6 months" in c:
            hit = repeat_count >= 3 or bool(re.search(r"(?:third|3rd)\s+(?:claim|repair|complaint)", text))
        elif "express shipping paid" in c:
            hit = "express shipping" in text or "express delivery" in text
        elif "perishable items" in c:
            hit = "perishable" in text
        elif "courier signature dispute" in c:
            hit = "signature" in text and ("courier" in text or "delivery" in text)
        elif "overdraft fees reported" in c:
            hit = "overdraft" in text
        elif "cancellation was submitted prior to renewal date" in c:
            hit = "cancelled before renewal" in text or "cancellation before renewal" in text
        elif "hazardous broken materials" in c:
            hit = any(term in text for term in ("hazardous", "broken glass", "sharp", "chemical"))
        elif "repeated failure of replaced unit" in c:
            hit = "replaced unit" in text and any(term in text for term in ("failed again", "again", "repeated failure"))
        elif "commercial downtime" in c:
            hit = "commercial downtime" in text or "business downtime" in text
        elif "refund initiated > 10 business days ago" in c:
            hit = bool(re.search(r"refund.*(?:11|12|13|14|15|16|17|18|19|20)\s*business\s*days", text))
        elif "final sale item dispute" in c:
            hit = "final sale" in text
        elif "multiple repeated repairs under warranty" in c:
            hit = ("repair" in text and "warranty" in text and (repeat_count >= 2 or "repeated" in text))
        elif "system-wide outage" in c:
            hit = "system-wide outage" in text or "system wide outage" in text
        elif "data corruption" in c:
            hit = "data corruption" in text
        elif "discrimination claim" in c:
            hit = "discrimination" in text
        elif "harassment allegation" in c:
            hit = "harassment" in text
        elif "high confidentiality item" in c:
            hit = "confidential" in text
        elif "prescription medical item" in c:
            hit = "prescription" in text or "medical item" in text
        elif "variant" in c and "requires specialist review" in c:
            # Variant rules are explicit matrix configuration; when the case
            # matches this configured rule, specialist review is mandatory.
            hit = True

        if hit:
            matched.append(str(condition))

    return matched

def validate_genai_output(complaint: Dict[str, Any], ai_output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Independent Python Ground-Truth Validation Pipeline.
    Evaluates AI output against deterministic rules and policies.
    """
    complaint_text = f"{complaint.get('title', '')} {complaint.get('description', '')}".lower()
    active_policies, outdated_policies = _policy_registry()
    customer_type = complaint.get("customer_type", "Regular")
    is_repeat = complaint.get("is_repeat", False) or bool(complaint.get("prev_complaint_ref"))
    
    # 1. Determine the ground-truth rule from the complaint itself.
    # The GenAI category is an input to validation, never the authority for
    # selecting the rule. This prevents a wrong AI classification from hiding
    # a mandatory escalation condition (for example, a legal or safety case).
    rule = find_matching_rule(
        category="",
        subcategory="",
        text=complaint_text
    )
    # If the complaint contains no rule-matrix keyword, fall back to the AI
    # classification so ordinary configured categories still validate.
    if not any(kw.lower() in complaint_text for kw in rule.get("keywords", [])):
        rule = find_matching_rule(
            category=ai_output.get("issue_category", ""),
            subcategory=ai_output.get("subcategory", ""),
            text=complaint_text
        )

    mismatches = []
    
    # Check 1: Category Check
    ai_category = ai_output.get("issue_category", "").strip()
    expected_category = rule["category"]
    category_passed = (ai_category.lower() == expected_category.lower())
    if not category_passed:
        # Check if alternative rule category fits text better
        mismatches.append(f"Category mismatch: GenAI suggested '{ai_category}' while Rule Matrix expected '{expected_category}'.")
    category_check = {
        "passed": category_passed,
        "genai_value": ai_category,
        "expected_value": expected_category,
        "reason": "Matches approved taxonomy" if category_passed else f"Expected category '{expected_category}' based on complaint keywords"
    }

    # Check 2: Department Check
    ai_department = ai_output.get("department", "").strip()
    expected_department = rule["department"]
    dept_passed = (ai_department.lower() == expected_department.lower())
    if not dept_passed:
        mismatches.append(f"Department routing mismatch: GenAI suggested '{ai_department}' while Rule Matrix routes to '{expected_department}'.")
    department_check = {
        "passed": dept_passed,
        "genai_value": ai_department,
        "expected_value": expected_department,
        "reason": f"Correct routing to {expected_department}" if dept_passed else f"Should route to {expected_department}"
    }

    # Check 3: Objective Urgency Check (Sentiment-Urgency Trap Protection)
    # Check if complaint contains safety keywords -> MUST BE Critical regardless of calm tone
    safety_triggers = ["fire", "smoke", "swollen battery", "spark", "burn", "electric shock", "exploded"]
    is_safety_case = any(kw in complaint_text for kw in safety_triggers)
    
    # Check if complaint is merely angry but low business risk
    angry_keywords = ["furious", "unacceptable", "terrible", "worst service ever", "disgusted"]
    is_angry_low_risk = any(kw in complaint_text for kw in angry_keywords) and not is_safety_case and rule["category"] in ["Delivery", "Technical Support"]

    expected_urgency = rule["default_urgency"]
    if is_safety_case:
        expected_urgency = "Critical"
    elif is_angry_low_risk:
        expected_urgency = "Medium" # Don't elevate to Critical merely because customer is angry

    ai_urgency = ai_output.get("urgency", "Medium").strip()
    urgency_passed = (ai_urgency.lower() == expected_urgency.lower())
    if not urgency_passed:
        if is_safety_case and ai_urgency.lower() != "critical":
            mismatches.append("Critical Urgency Trap: Safety hazard must be marked Critical urgency regardless of tone.")
        elif is_angry_low_risk and ai_urgency.lower() in ["critical", "high"]:
            mismatches.append("Sentiment-Urgency Trap: Emotional anger detected without critical business impact; expected Medium urgency.")
        else:
            mismatches.append(f"Urgency mismatch: GenAI set '{ai_urgency}' vs Ground-Truth expected '{expected_urgency}'.")

    urgency_check = {
        "passed": urgency_passed,
        "genai_value": ai_urgency,
        "expected_value": expected_urgency,
        "reason": f"Objective risk rating: {expected_urgency}" if urgency_passed else f"Expected {expected_urgency} based on deterministic risk analysis"
    }

    # Check 4: Priority Check
    expected_priority = rule["default_priority"]
    if is_safety_case:
        expected_priority = "P0"
    elif is_repeat:
        # Repeat complaint raises priority by one level
        expected_priority = "P1" if expected_priority in ["P2", "P3"] else expected_priority

    ai_priority = ai_output.get("priority", "P2").strip()
    priority_passed = (ai_priority.upper() == expected_priority.upper())
    if not priority_passed:
        mismatches.append(f"Priority mismatch: GenAI specified '{ai_priority}' vs Ground-Truth SLA priority '{expected_priority}'.")
    priority_check = {
        "passed": priority_passed,
        "genai_value": ai_priority,
        "expected_value": expected_priority,
        "reason": f"SLA Priority tier {expected_priority}" if priority_passed else f"Expected priority tier {expected_priority}"
    }

    # Check 5: Policy Reference & Version Check
    ai_policy_id = ai_output.get("policy_id", "").strip()
    policy_status = "Unknown"
    policy_passed = False
    
    if ai_policy_id in active_policies:
        policy_status = "Active"
        policy_passed = True
    elif ai_policy_id in outdated_policies:
        policy_status = "Outdated/Superseded"
        policy_passed = False
        mismatches.append(f"Outdated Policy Reference: GenAI referenced '{ai_policy_id}' which is superseded.")
    else:
        policy_status = "Invalid/Unregistered"
        policy_passed = False
        mismatches.append(f"Invalid Policy ID: '{ai_policy_id}' does not exist in company Knowledge Base.")

    retrieved_policy_ids = [str(x) for x in (complaint.get("retrieved_policy_ids") or []) if x]
    expected_policy = rule.get("policy_id") or ""

    # Authority order (SRS):
    # 1) ACTIVE_POLICIES registry + Rule Matrix expected policy
    # 2) Retrieval is best-effort grounding — do not fail an Active, rule-aligned policy
    #    solely because lexical retrieval returned a different/empty source set.
    if policy_passed:
        if ai_policy_id == expected_policy:
            policy_status = "Active (rule-matrix aligned)"
        elif expected_policy and ai_policy_id != expected_policy:
            # Soft disagreement: keep Active status, record mismatch for review
            mismatches.append(
                f"Policy preference mismatch: GenAI used '{ai_policy_id}' while Rule Matrix prefers '{expected_policy}'."
            )
            policy_status = f"Active (GenAI={ai_policy_id}, matrix={expected_policy})"
        # Traceability: only hard-fail when retrieval returned POLICY-CODE ids and
        # the chosen id is neither in that set nor the matrix expectation.
        policy_code_hits = [p for p in retrieved_policy_ids if isinstance(p, str) and ("-POL-" in p or "-SOP-" in p)]
        if policy_code_hits and ai_policy_id not in policy_code_hits and ai_policy_id != expected_policy:
            mismatches.append(
                f"Policy source traceability mismatch: '{ai_policy_id}' was not present in the retrieved active Knowledge Base sources."
            )
            policy_passed = False
            policy_status = "Active but not traceable to retrieved source"

    policy_check = {
        "passed": policy_passed,
        "genai_value": ai_policy_id,
        "policy_status": policy_status,
        "expected_policy": expected_policy,
        "retrieved_policy_ids": retrieved_policy_ids,
        "reason": (
            f"Valid active policy {ai_policy_id} ({policy_status})"
            if policy_passed
            else f"Referenced policy '{ai_policy_id}' is {policy_status}; expected {expected_policy}"
        ),
    }

    # Check 6: Resolution Rules, required actions and prohibited actions.
    unsupported_promises: List[str] = []
    resolution_text = (
        (ai_output.get("professional_response", "") or "")
        + " "
        + " ".join(ai_output.get("resolution_steps", []) or [])
    ).lower()

    def _meaningful_tokens(value: str) -> set[str]:
        return {
            token for token in re.findall(r"[a-z0-9]{4,}", value.lower())
            if token not in {"with", "from", "that", "this", "before", "after", "within", "customer"}
        }

    # Explicitly detect commitments that the policy does not authorize.
    if any(p in resolution_text for p in (
        "guaranteed refund", "guarantee a full refund", "instant refund",
        "immediate money back", "guaranteed compensation", "guaranteed delivery",
        "unauthorized policy exception",
    )):
        unsupported_promises.append("Customer-facing output contains an unsupported guarantee or commitment.")

    # Every mandatory action must be represented with meaningful token overlap.
    missing_actions = []
    for required in rule.get("required_actions", []):
        req_tokens = _meaningful_tokens(required)
        if req_tokens:
            overlap = len(req_tokens & _meaningful_tokens(resolution_text)) / len(req_tokens)
            if overlap < 0.50:
                missing_actions.append(required)

    # Prohibited actions are violations only when the generated text actually
    # recommends the prohibited action; merely sharing words is not enough.
    prohibited_violations = []
    response_parts = ai_output.get("resolution_steps", []) or []
    for prohibited in rule.get("prohibited_actions", []):
        p_tokens = _meaningful_tokens(prohibited)
        for part in response_parts:
            overlap = len(p_tokens & _meaningful_tokens(str(part))) / max(1, len(p_tokens))
            if overlap >= 0.65:
                prohibited_violations.append(prohibited)
                break

    if missing_actions:
        unsupported_promises.append(
            "Missing mandatory resolution actions: " + "; ".join(missing_actions)
        )
    if prohibited_violations:
        unsupported_promises.append(
            "Generated resolution recommends prohibited actions: " + "; ".join(prohibited_violations)
        )

    resolution_passed = len(unsupported_promises) == 0
    if not resolution_passed:
        mismatches.extend(unsupported_promises)

    resolution_check = {
        "passed": resolution_passed,
        "unsupported_promises": unsupported_promises,
        "required_actions": rule.get("required_actions", []),
        "missing_required_actions": missing_actions,
        "prohibited_action_violations": prohibited_violations,
        "reason": (
            "Resolution steps contain required actions and no prohibited commitments"
            if resolution_passed
            else "Resolution output does not fully comply with the matched Rule Matrix rule"
        ),
    }

    # Check 7: Authoritative Escalation Check
    # Python makes the final authoritative decision on mandatory escalation
    python_escalation_required = rule.get("mandatory_escalation", False)
    escalation_reason = rule.get("escalation_reason", "")

    # Mandatory triggers. The rule's explicit escalation conditions are
    # evaluated independently of GenAI. Generic repeat/legal/safety triggers
    # are also enforced as deterministic safety nets.
    matched_conditions = _evaluate_escalation_conditions(rule, complaint, complaint_text)

    if rule.get("mandatory_escalation"):
        python_escalation_required = True
        escalation_reason = rule.get("escalation_reason") or "Mandatory escalation condition in the Rule Matrix"
    if matched_conditions:
        python_escalation_required = True
        escalation_reason = matched_conditions[0]
    if is_safety_case:
        python_escalation_required = True
        escalation_reason = "Product safety hazard / thermal or physical risk"
    elif "lawsuit" in complaint_text or "attorney" in complaint_text or "court" in complaint_text or "legal action" in complaint_text:
        python_escalation_required = True
        escalation_reason = "Customer legal representation threat"
    else:
        # Only escalate true unresolved repeats (not weak similarity on a first complaint).
        # Requires: is_repeat flag AND (repeat_count >= 2 OR prev ref OR unresolved language).
        unresolved_terms = ("unresolved", "still not", "again", "repeated", "second time", "third time", "no response", "not resolved")
        has_unresolved_language = any(t in complaint_text for t in unresolved_terms)
        repeat_count = int(complaint.get("repeat_count") or 0)
        prev_ref = bool(complaint.get("prev_complaint_ref"))
        true_repeat = bool(is_repeat) and (repeat_count >= 2 or prev_ref or has_unresolved_language)
        if true_repeat:
            python_escalation_required = True
            escalation_reason = "Repeated unresolved complaint"

    ai_escalation = bool(ai_output.get("escalation_required", False))
    escalation_passed = (ai_escalation == python_escalation_required)

    if not escalation_passed:
        if python_escalation_required and not ai_escalation:
            mismatches.append(f"Escalation Trap: GenAI failed to escalate a mandatory case ({escalation_reason}).")
        else:
            mismatches.append(f"Escalation Disagreement: GenAI recommended escalation but Python rule matrix does not require it.")

    # Ground-truth is authoritative: when Python mandates escalation, the check
    # itself is considered correctly applied. GenAI disagreement (if any) remains
    # in mismatches for MANUAL REVIEW routing.
    if python_escalation_required:
        escalation_check = {
            "passed": True if ai_escalation else escalation_passed,
            "genai_value": ai_escalation,
            "python_authoritative_decision": True,
            "escalation_reason": escalation_reason,
            "reason": (
                f"Escalation verified: Required ({escalation_reason})"
                if ai_escalation
                else f"Ground-Truth mandates escalation: {escalation_reason}"
            ),
        }
        # If GenAI already agreed, force passed=True
        if ai_escalation:
            escalation_check["passed"] = True
            escalation_check["reason"] = f"Escalation verified: Required ({escalation_reason})"
    else:
        escalation_check = {
            "passed": escalation_passed,
            "genai_value": ai_escalation,
            "python_authoritative_decision": False,
            "escalation_reason": escalation_reason or "No Escalation",
            "reason": (
                "Escalation verified: Not Required"
                if escalation_passed
                else "Escalation Disagreement: GenAI escalated without rule-matrix requirement"
            ),
        }

    # Check 8: Follow-up Rules Check
    follow_up_passed = bool(ai_output.get("follow_up_required", False)) or bool(rule.get("follow_up"))
    follow_up_check = {
        "passed": True,
        "recommended_follow_up": rule.get("follow_up", "Standard case closure"),
        "reason": "Follow-up protocol defined"
    }

    # Check 9: Source Validation & Hallucination Check.
    # This deterministic layer checks common unsupported factual commitments.
    hallucinations = []
    complaint_terms = set(re.findall(r"[a-z0-9]{4,}", complaint_text))
    source_terms = set()
    expected_policy = rule.get("policy_id") or ""
    if expected_policy:
        source_terms.update(_meaningful_tokens(expected_policy))

    factual_patterns = [
        (r"\bwe (?:already )?called\b", "claimed an outbound call not present in complaint data"),
        (r"\bwe (?:already )?processed\b.*\brefund\b", "claimed a refund was already processed"),
        (r"\bwe (?:already )?issued\b.*\bcompensation\b", "claimed compensation was already issued"),
        (r"\bcarrier confirmed\b", "claimed a carrier confirmation not present in complaint data"),
        (r"\bapproved (?:your|the) refund\b", "claimed refund approval without rule-backed evidence"),
        (r"\bguaranteed\b", "made a guarantee requiring explicit policy support"),
    ]
    for pattern, reason in factual_patterns:
        if re.search(pattern, resolution_text, re.I):
            if "guaranteed" in pattern and not rule.get("required_actions"):
                hallucinations.append(reason)
            elif "refund" in pattern and rule.get("category") not in {"Refund", "Billing"}:
                hallucinations.append(reason)
            elif "called" in pattern and not any(x in complaint_text for x in ("phone", "called", "call")):
                hallucinations.append(reason)
            elif "carrier" in pattern and "carrier" not in complaint_text:
                hallucinations.append(reason)
            elif "compensation" in pattern and "compensation" not in complaint_text:
                hallucinations.append(reason)

    source_check = {
        "passed": len(hallucinations) == 0,
        "hallucinations": hallucinations,
        "traceable_policy": expected_policy,
        "reason": (
            "Generated claims passed deterministic traceability checks"
            if not hallucinations
            else "Generated output contains claims that are not supported by complaint/rule evidence"
        ),
    }

    # Overall Comparison Decision
    all_checks = [category_check, department_check, urgency_check, priority_check, policy_check, resolution_check, escalation_check, source_check]
    passed_count = sum(1 for c in all_checks if c["passed"])
    comparison_score = round((passed_count / len(all_checks)) * 100, 1)

    verification_status = "VERIFIED" if (len(mismatches) == 0 and comparison_score >= 90.0) else "MANUAL REVIEW REQUIRED"

    return {
        "category_check": category_check,
        "department_check": department_check,
        "urgency_check": urgency_check,
        "priority_check": priority_check,
        "policy_check": policy_check,
        "resolution_check": resolution_check,
        "escalation_check": escalation_check,
        "follow_up_check": follow_up_check,
        "source_check": source_check,
        "unsupported_promises": unsupported_promises,
        "hallucinations": hallucinations,
        "overall_status": "PASSED" if verification_status == "VERIFIED" else "FAILED",
        "verification_status": verification_status,
        "mismatches": mismatches,
        "mismatch_count": len(mismatches),
        "comparison_score": comparison_score,
        "validation_summary": (
            "All ground-truth checks passed successfully. Complaint is verified."
            if verification_status == "VERIFIED"
            else f"{len(mismatches)} mismatch(es) detected between GenAI and Python rule matrix. Routed to Manual Review Queue."
        )
    }
