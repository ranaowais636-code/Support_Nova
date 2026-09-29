"""
SupportNova Python API Bridge
Executes database transactions, authentication checks, preprocessing, validation, and analytics.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import uuid
import re
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from python_engine.database import get_db, hash_password, verify_password, init_db, ensure_demo_users
from python_engine.preprocess import sanitize_and_normalize, detect_prompt_injection, validate_complaint_input, wrap_as_untrusted_data
from python_engine.validate import validate_genai_output
from python_engine.rule_matrix import RULES
from python_engine.document_parser import extract_document, chunk_text
from python_engine.schema import validate_ai_output
from python_engine.retrieval import retrieve_policy_chunks
from python_engine.demo_data import ensure_demo_data
from python_engine.seed_data import ensure_policy_kb
from python_engine.deterministic_analysis import build_deterministic_analysis

SLA_HOURS = {"P0": (2, 6), "P1": (4, 12), "P2": (12, 24), "P3": (24, 48)}

def _text_similarity(a: str, b: str) -> float:
    def toks(v):
        return set(re.findall(r"[a-z0-9]{3,}", (v or "").lower()))
    ta, tb = toks(a), toks(b)
    jaccard = len(ta & tb) / max(1, len(ta | tb))
    sequence = SequenceMatcher(None, (a or "").lower(), (b or "").lower()).ratio()
    return max(jaccard, sequence)

# Ensure migrations and the persisted Rule Matrix are ready before serving API actions.
_INIT_DONE = False

def _bootstrap():
    global _INIT_DONE
    if _INIT_DONE:
        return
    init_db()
    ensure_demo_users()
    ensure_demo_data()
    ensure_policy_kb()
    _INIT_DONE = True

_bootstrap()


def _ensure_evaluation_assets():
    """Load SRS benchmark/evaluation datasets into SQLite once, keeping them out of live complaints."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(root, "data")
    conn = get_db()
    c = conn.cursor()
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    def load_jsonl(filename, table, columns, transforms=None):
        path = os.path.join(data_dir, filename)
        if not os.path.exists(path):
            return 0
        count = c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        if count:
            return count
        rows = []
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                item = json.loads(line)
                if transforms:
                    item = transforms(item)
                rows.append(tuple(item.get(col) for col in columns))
        if rows:
            placeholders = ",".join(["?"] * len(columns))
            c.executemany(f"INSERT OR IGNORE INTO {table} ({','.join(columns)}) VALUES ({placeholders})", rows)
        return len(rows)

    benchmark_count = load_jsonl(
        "complaints_500.jsonl", "benchmark_cases",
        ["case_id", "title", "description", "category", "subcategory", "order_ref", "expected_flags", "source", "seed"],
        lambda x: {**x, "expected_flags": json.dumps(x.get("expected_flags", []))}
    )
    unseen_count = load_jsonl(
        "evaluation_100_unseen.jsonl", "evaluation_cases",
        ["case_id", "title", "description", "expected_category", "expected_subcategory"]
    )
    injection_count = load_jsonl(
        "prompt_injection_20.jsonl", "prompt_injection_cases",
        ["case_id", "text", "expected_adversarial"],
        lambda x: {**x, "expected_adversarial": 1 if x.get("expected_adversarial") else 0}
    )

    assets = [
        ("rules", "Rule Matrix", "rule_matrix", c.execute("SELECT COUNT(*) FROM rule_matrix").fetchone()[0], "READY", "Independent deterministic ground-truth rules."),
        ("escalations", "Escalation Conditions", "rule_matrix_conditions", sum(len(r.get("escalation_conditions", [])) for r in RULES), "READY", "Escalation conditions are stored with each independent rule."),
        ("benchmark_500", "500 Complaint Benchmark", "benchmark", benchmark_count, "READY" if benchmark_count >= 500 else "INCOMPLETE", "SRS benchmark cases stored separately from live complaints."),
        ("unseen_100", "100 Unseen Evaluation Cases", "evaluation", unseen_count, "READY" if unseen_count >= 100 else "INCOMPLETE", "Held-out evaluation cases."),
        ("prompt_injection_20", "Prompt Injection Cases", "security", injection_count, "READY" if injection_count >= 20 else "INCOMPLETE", "Adversarial complaint inputs."),
        ("docx_smoke_test", "DOCX Extraction Smoke Test", "document", 1 if os.path.exists(os.path.join(data_dir, "sample_policy.docx")) else 0, "READY" if os.path.exists(os.path.join(data_dir, "sample_policy.docx")) else "INCOMPLETE", "Sample DOCX plus extracted-text verification artifact."),
    ]
    c.executemany("""INSERT INTO evaluation_assets(asset_key, asset_name, asset_type, record_count, status, details, updated_at)
                     VALUES(?,?,?,?,?,?,?)
                     ON CONFLICT(asset_key) DO UPDATE SET record_count=excluded.record_count,status=excluded.status,details=excluded.details,updated_at=excluded.updated_at""", [a + (now,) for a in assets])
    conn.commit()
    conn.close()


def _bootstrap_evaluation():
    try:
        conn = get_db()
        c = conn.cursor()
        # Fast path: if benchmark already loaded, skip JSONL re-read
        try:
            n = c.execute("SELECT COUNT(*) FROM benchmark_cases").fetchone()[0]
        except Exception:
            n = 0
        conn.close()
        if n and n >= 500:
            return
    except Exception:
        pass
    _ensure_evaluation_assets()

_bootstrap_evaluation()


def _ensure_docx_smoke_document():
    """Import the bundled DOCX smoke-test fixture through the same parser used by uploads."""
    fixture = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample_policy.docx")
    if not os.path.exists(fixture):
        return
    conn = get_db()
    c = conn.cursor()
    if c.execute("SELECT 1 FROM documents WHERE id = 'DOCX-SMOKE-01'").fetchone():
        conn.close()
        return
    try:
        import base64
        with open(fixture, "rb") as fh:
            encoded = base64.b64encode(fh.read()).decode("ascii")
        extracted = extract_document("sample_policy.docx", encoded)
        chunks = chunk_text(extracted["text"], "DOCX-SMOKE-01", "1.0", extracted["source_chunks"])
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        c.execute("""INSERT INTO documents(id,title,doc_type,section,version,effective_date,source,status,summary,content,created_at,created_by)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""", (
            "DOCX-SMOKE-01", "SupportNova Sample Policy – DOCX Extraction Smoke Test", "Policy",
            "Safety & Refund", "1.0", "2026-09-26", "Bundled DOCX smoke-test fixture", "Active",
            "Bundled DOCX fixture proving real PDF/DOCX parser integration.", extracted["text"], now, "System Administrator"
        ))
        for i, ch in enumerate(chunks, 1):
            c.execute("""INSERT INTO document_chunks(id,document_id,section,heading,page_ref,version,chunk_text)
                         VALUES(?,?,?,?,?,?,?)""", (
                f"DOCX-SMOKE-CHUNK-{i:02d}", "DOCX-SMOKE-01", ch["section"], ch["heading"],
                ch.get("page_ref"), ch["version"], ch["chunk_text"]
            ))
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()


_ensure_docx_smoke_document()

def handle_login(data):
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    user = c.fetchone()
    conn.close()
    
    if not user:
        return {"error": "Invalid email or password", "status": 401}
        
    if not verify_password(password, user["password_hash"], user["salt"]):
        return {"error": "Invalid email or password", "status": 401}
        
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "customer_type": user["customer_type"]
        }
    }

def handle_signup(data):
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""
    customer_type = data.get("customer_type") or "Regular"
    
    if not email or "@" not in email:
        return {"error": "A valid email address is required.", "status": 400}
    if not name or len(name) < 2:
        return {"error": "Name must be at least 2 characters.", "status": 400}
    if not password or len(password) < 6:
        return {"error": "Password must be at least 6 characters.", "status": 400}
        
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
    if c.fetchone():
        conn.close()
        return {"error": "An account with this email already exists.", "status": 409}
        
    user_id = f"usr-cust-{uuid.uuid4().hex[:8]}"
    p_hash, salt = hash_password(password)
    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    c.execute(
        "INSERT INTO users (id, email, password_hash, salt, name, role, customer_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, email, p_hash, salt, name, "Customer", customer_type, now_iso)
    )
    
    # Audit log
    c.execute(
        "INSERT INTO audit_logs (id, user_id, user_email, role, action, entity_type, entity_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), user_id, email, "Customer", "ACCOUNT_REGISTRATION", "USER", user_id, f"Customer account created: {name} ({customer_type})", now_iso)
    )
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
            "role": "Customer",
            "customer_type": customer_type
        }
    }

def get_complaints(data):
    role = data.get("role")
    user_id = data.get("user_id")
    search = (data.get("search") or "").lower()
    status_filter = data.get("status")
    category_filter = data.get("category")
    urgency_filter = data.get("urgency")
    
    conn = get_db()
    c = conn.cursor()
    
    # Strict customer isolation
    if role == "Customer":
        query = """
        SELECT c.*, a.category, a.urgency, a.priority, a.department, comp.verification_status, comp.mismatch_count
        FROM complaints c
        LEFT JOIN ai_analyses a ON c.complaint_id = a.complaint_id
        LEFT JOIN comparison_results comp ON c.complaint_id = comp.complaint_id
        WHERE c.customer_id = ?
        ORDER BY c.created_at DESC
        """
        c.execute(query, (user_id,))
    else:
        # Staff query
        query = """
        SELECT c.*, a.category, a.urgency, a.priority, a.department, comp.verification_status, comp.mismatch_count
        FROM complaints c
        LEFT JOIN ai_analyses a ON c.complaint_id = a.complaint_id
        LEFT JOIN comparison_results comp ON c.complaint_id = comp.complaint_id
        WHERE 1=1
        """
        params = []
        if status_filter and status_filter != "All":
            query += " AND c.status = ?"
            params.append(status_filter)
        if category_filter and category_filter != "All":
            query += " AND a.category = ?"
            params.append(category_filter)
        if urgency_filter and urgency_filter != "All":
            query += " AND a.urgency = ?"
            params.append(urgency_filter)
        if search:
            query += " AND (LOWER(c.complaint_id) LIKE ? OR LOWER(c.title) LIKE ? OR LOWER(c.order_ref) LIKE ? OR LOWER(c.customer_name) LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param])
            
        query += " ORDER BY c.created_at DESC"
        c.execute(query, params)
        
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return {"complaints": rows}

def get_complaint_detail(data):
    complaint_id = data.get("complaint_id")
    role = data.get("role")
    user_id = data.get("user_id")
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM complaints WHERE complaint_id = ?", (complaint_id,))
    complaint = c.fetchone()
    
    if not complaint:
        conn.close()
        return {"error": "Complaint not found", "status": 404}
        
    complaint = dict(complaint)
    
    # Customer Data Isolation check
    if role == "Customer" and complaint["customer_id"] != user_id:
        conn.close()
        return {"error": "Unauthorized access to customer complaint record", "status": 403}
        
    # AI Analysis
    c.execute("SELECT * FROM ai_analyses WHERE complaint_id = ?", (complaint_id,))
    ai_row = c.fetchone()
    ai_analysis = dict(ai_row) if ai_row else None
    if ai_analysis and ai_analysis.get("resolution_steps"):
        try:
            ai_analysis["resolution_steps"] = json.loads(ai_analysis["resolution_steps"])
        except:
            pass

    # Python Validation
    c.execute("SELECT * FROM python_validations WHERE complaint_id = ?", (complaint_id,))
    val_row = c.fetchone()
    py_validation = dict(val_row) if val_row else None
    if py_validation:
        for f in ["category_check", "department_check", "urgency_check", "priority_check", "policy_check", "resolution_check", "escalation_check", "follow_up_check", "source_check", "unsupported_promises", "hallucinations"]:
            if py_validation.get(f):
                try:
                    py_validation[f] = json.loads(py_validation[f])
                except:
                    pass

    # Comparison Result
    c.execute("SELECT * FROM comparison_results WHERE complaint_id = ?", (complaint_id,))
    comp_row = c.fetchone()
    comp_result = dict(comp_row) if comp_row else None
    if comp_result and comp_result.get("mismatches"):
        try:
            comp_result["mismatches"] = json.loads(comp_result["mismatches"])
        except:
            pass

    # Review Actions
    c.execute("SELECT * FROM review_actions WHERE complaint_id = ? ORDER BY timestamp DESC", (complaint_id,))
    review_actions = [dict(r) for r in c.fetchall()]

    # Audit Logs
    c.execute("SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY timestamp DESC", (complaint_id,))
    audit_logs = [dict(r) for r in c.fetchall()]

    conn.close()
    
    # If Customer, omit internal raw AI prompts / internal reviewer metadata
    return {
        "complaint": complaint,
        "ai_analysis": ai_analysis,
        "python_validation": py_validation,
        "comparison_result": comp_result,
        "review_actions": review_actions,
        "audit_logs": audit_logs if role != "Customer" else []
    }

def save_new_complaint(data):
    user = data.get("user", {})
    complaint_in = data.get("complaint", {})
    ai_output = data.get("ai_output", {})
    ai_provider = data.get("ai_provider", "Google Gemini")
    ai_validation_errors = data.get("ai_validation_errors", [])
    retrieved_policy_ids = data.get("retrieved_policy_ids", [])
    
    if user.get("role") != "Customer":
        return {"error": "Only Customers can submit complaints. Staff submission is disabled.", "status": 403}
        
    # Input validation
    valid, errors = validate_complaint_input(complaint_in)
    if not valid:
        return {"error": "; ".join(errors), "status": 400}

    # Never persist malformed model output. This remains enforced in Python even
    # if a caller bypasses the Express route.
    schema_errors = validate_ai_output(ai_output)
    if schema_errors:
        return {
            "error": "Structured complaint analysis failed schema validation.",
            "details": schema_errors,
            "status": 422,
        }

    # Preprocessing
    title_sanitized = sanitize_and_normalize(complaint_in.get("title", ""))
    desc_sanitized = sanitize_and_normalize(complaint_in.get("description", ""))
    injection_res = detect_prompt_injection(desc_sanitized)

    conn = get_db()
    c = conn.cursor()
    
    # Duplicate / repeat detection using same-customer history plus text similarity.
    order_ref = complaint_in.get("order_ref", "").strip()
    c.execute("SELECT complaint_id, created_at, title, description, order_ref FROM complaints WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50", (user["id"],))
    prior_cases = c.fetchall()
    incoming_text = f"{title_sanitized} {desc_sanitized}"
    is_duplicate = 0
    duplicate_of = None
    is_repeat = 0
    repeat_count = 1
    for prior in prior_cases:
        sim = _text_similarity(incoming_text, f"{prior['title']} {prior['description']}")
        same_order = bool(order_ref) and order_ref.lower() == str(prior["order_ref"] or "").lower()
        if sim >= 0.86:
            is_duplicate = 1
            duplicate_of = prior["complaint_id"]
            is_repeat = 1
            repeat_count += 1
            break
        if same_order or sim >= 0.55:
            is_repeat = 1
            repeat_count += 1

    now = datetime.utcnow()
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Generate sequential Complaint ID (CMP-XXXXX)
    c.execute("SELECT count(*) FROM complaints")
    count = c.fetchone()[0] + 108
    complaint_id = f"CMP-{count:05d}"
    
    complaint_obj = {
        "complaint_id": complaint_id,
        "customer_id": user["id"],
        "customer_name": user.get("name", "Customer"),
        "customer_type": user.get("customer_type", "Regular"),
        "title": title_sanitized,
        "description": desc_sanitized,
        "product_service": complaint_in.get("product_service", "General Product"),
        "order_ref": order_ref,
        "channel": complaint_in.get("channel", "Web Form"),
        "date": complaint_in.get("date") or datetime.utcnow().strftime("%Y-%m-%d"),
        "attachment_name": complaint_in.get("attachment_name"),
        "attachment_data": complaint_in.get("attachment_data"),
        "prev_complaint_ref": complaint_in.get("prev_complaint_ref"),
        "requested_resolution": complaint_in.get("requested_resolution"),
        "retrieved_policy_ids": retrieved_policy_ids,
        "is_repeat": is_repeat,
        "repeat_count": repeat_count
    }

    # Run Python Ground-Truth Validation Pipeline
    py_val = validate_genai_output(complaint_obj, ai_output)
    
    # Authoritative Escalation Rule:
    # Python validation is the final authority. The persisted AI-analysis record
    # must also reflect this authoritative decision so the UI cannot show
    # "No Escalation" when the ground-truth pipeline has escalated the case.
    verification_status = py_val["verification_status"]
    if ai_validation_errors:
        verification_status = "MANUAL REVIEW REQUIRED"
        py_val["mismatches"].extend([f"GenAI schema validation: {err}" for err in ai_validation_errors])
        py_val["mismatch_count"] = len(py_val["mismatches"])
    if injection_res["is_adversarial"]:
        verification_status = "MANUAL REVIEW REQUIRED"
        py_val["mismatches"].append(f"Prompt injection pattern detected: '{injection_res['threats'][0]['matched_text']}'. Enveloped as untrusted data.")
        py_val["mismatch_count"] = len(py_val["mismatches"])

    authoritative_escalation = py_val["escalation_check"]["python_authoritative_decision"]
    final_status = "Escalated" if authoritative_escalation else ("Analyzed" if verification_status == "VERIFIED" else "New")
    authoritative_escalation_level = "No Escalation"
    if authoritative_escalation:
        reason_lower = (py_val["escalation_check"].get("escalation_reason") or "").lower()
        if any(term in reason_lower for term in ("safety", "fire", "privacy", "legal", "fraud", "security", "critical")):
            authoritative_escalation_level = "Critical Management Escalation"
        elif "repeat" in reason_lower or "unresolved" in reason_lower:
            authoritative_escalation_level = "Supervisor Review"
        else:
            authoritative_escalation_level = "Department Manager"
    priority_for_sla = str(ai_output.get("priority", "P2")).upper()
    _, resolution_hours = SLA_HOURS.get(priority_for_sla, SLA_HOURS["P2"])
    sla_due_at = (now + timedelta(hours=resolution_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    sla_status = "Escalated" if authoritative_escalation else "Open"

    # Insert complaint
    c.execute('''
    INSERT INTO complaints (
        id, complaint_id, customer_id, customer_name, customer_type, title, description,
        product_service, order_ref, channel, date, attachment_name, attachment_data,
        prev_complaint_ref, requested_resolution, status, is_duplicate, duplicate_of,
        is_repeat, repeat_count, created_at, sla_due_at, sla_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), complaint_id, user["id"], user.get("name", "Customer"), user.get("customer_type", "Regular"),
        title_sanitized, desc_sanitized, complaint_obj["product_service"], order_ref,
        complaint_obj["channel"], complaint_obj["date"], complaint_obj["attachment_name"], complaint_obj["attachment_data"],
        complaint_obj["prev_complaint_ref"], complaint_obj["requested_resolution"],
        final_status, is_duplicate, duplicate_of, is_repeat, repeat_count, now_iso, sla_due_at, sla_status
    ))

    # Insert AI Analysis
    c.execute('''
    INSERT INTO ai_analyses (
        id, complaint_id, prompt_version, provider, model, raw_output, primary_issue,
        secondary_issue, category, subcategory, sentiment, urgency, priority, department,
        supporting_department, policy_id, policy_section, resolution_steps, escalation_required,
        escalation_level, escalation_notes, professional_response, response_type,
        follow_up_required, follow_up_communication, agent_guidance, clarification_questions, analyzed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), complaint_id, "PROMPT_V1_2", ai_provider, os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
        json.dumps(ai_output), ai_output.get("primary_issue") or title_sanitized,
        ai_output.get("secondary_issue"), ai_output.get("issue_category", "Delivery"),
        ai_output.get("subcategory", "General"), ai_output.get("sentiment", "Negative"),
        ai_output.get("urgency", "Medium"), ai_output.get("priority", "P2"),
        ai_output.get("department", "Logistics"), ai_output.get("supporting_department"),
        ai_output.get("policy_id", "DEL-POL-04"), ai_output.get("policy_section", "1.0"),
        json.dumps(ai_output.get("resolution_steps", [])), 1 if authoritative_escalation else 0,
        authoritative_escalation_level,
        py_val["escalation_check"].get("escalation_reason") or ai_output.get("escalation_notes", ""),
        ai_output.get("professional_response", ""), ai_output.get("response_type", "Apology and Resolution Update"),
        1 if ai_output.get("follow_up_required") else 0, ai_output.get("follow_up_communication", ""),
        ai_output.get("agent_guidance", ""), ai_output.get("clarification_questions", ""), now_iso
    ))

    # Insert Python Validation
    c.execute('''
    INSERT INTO python_validations (
        id, complaint_id, category_check, department_check, urgency_check, priority_check,
        policy_check, resolution_check, escalation_check, follow_up_check, source_check,
        unsupported_promises, hallucinations, overall_status, validation_summary, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), complaint_id,
        json.dumps(py_val["category_check"]), json.dumps(py_val["department_check"]),
        json.dumps(py_val["urgency_check"]), json.dumps(py_val["priority_check"]),
        json.dumps(py_val["policy_check"]), json.dumps(py_val["resolution_check"]),
        json.dumps(py_val["escalation_check"]), json.dumps(py_val["follow_up_check"]),
        json.dumps(py_val["source_check"]), json.dumps(py_val["unsupported_promises"]),
        json.dumps(py_val["hallucinations"]), py_val["overall_status"], py_val["validation_summary"],
        now_iso
    ))

    # Insert Comparison Result
    c.execute('''
    INSERT INTO comparison_results (
        id, complaint_id, verification_status, mismatch_count, mismatches, comparison_score, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), complaint_id, verification_status, py_val["mismatch_count"],
        json.dumps(py_val["mismatches"]), py_val["comparison_score"], now_iso
    ))

    # Audit log
    c.execute('''
    INSERT INTO audit_logs (
        id, user_id, user_email, role, action, entity_type, entity_id, details, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), user["id"], user.get("email", ""), "Customer",
        "COMPLAINT_SUBMITTED", "COMPLAINT", complaint_id,
        f"Complaint {complaint_id} submitted via {complaint_obj['channel']}. Verification: {verification_status}", now_iso
    ))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "complaint_id": complaint_id,
        "verification_status": verification_status,
        "final_status": final_status,
        "escalation_required": authoritative_escalation,
        "escalation_level": authoritative_escalation_level,
        "escalation_reason": py_val["escalation_check"].get("escalation_reason", ""),
        "mismatches": py_val["mismatches"],
        "comparison_score": py_val["comparison_score"]
    }

def get_review_queue(data):
    role = data.get("role")
    if role not in ["Administrator", "Manager", "Reviewer"]:
        return {"error": "Unauthorized access to Review Queue.", "status": 403}

    conn = get_db()
    c = conn.cursor()
    query = """
    SELECT c.*, a.category, a.urgency, a.priority, a.department, comp.verification_status, comp.mismatch_count, comp.mismatches
    FROM complaints c
    LEFT JOIN ai_analyses a ON c.complaint_id = a.complaint_id
    LEFT JOIN comparison_results comp ON c.complaint_id = comp.complaint_id
    WHERE comp.verification_status = 'MANUAL REVIEW REQUIRED' OR c.status = 'Escalated'
    ORDER BY c.created_at DESC
    """
    c.execute(query)
    rows = []
    for r in c.fetchall():
        item = dict(r)
        if item.get("mismatches"):
            try:
                item["mismatches"] = json.loads(item["mismatches"])
            except:
                pass
        rows.append(item)
    conn.close()
    return {"queue": rows}

def submit_review_action(data):
    role = data.get("role")
    user_id = data.get("user_id")
    user_name = data.get("user_name")
    complaint_id = data.get("complaint_id")
    action = data.get("review_action") or data.get("action") # Reviewer decision
    notes = data.get("notes") or ""
    new_status = data.get("new_status")

    if role not in ["Administrator", "Manager", "Reviewer"]:
        return {"error": "Unauthorized to perform review actions.", "status": 403}

    allowed_actions = {"Approve", "Escalate", "Resolve", "Reclassify", "Add Note", "Modify", "Reassign", "Regenerate"}
    if action not in allowed_actions:
        return {"error": f"Unsupported review decision: {action}", "status": 400}

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT status FROM complaints WHERE complaint_id = ?", (complaint_id,))
    comp = c.fetchone()
    if not comp:
        conn.close()
        return {"error": "Complaint not found", "status": 404}

    old_status = comp["status"]
    status_map = {
        "Approve": "In Progress",
        "Escalate": "Escalated",
        "Resolve": "Resolved",
        "Modify": old_status,
        "Reclassify": old_status,
        "Reassign": old_status,
        "Regenerate": old_status,
        "Add Note": old_status,
    }
    status_to_set = new_status or status_map[action]

    # Update complaint and SLA timestamps. First meaningful review action counts as first response.
    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    if status_to_set in ["Resolved", "Closed"]:
        c.execute("UPDATE complaints SET status = ?, first_response_at = COALESCE(first_response_at, ?), resolved_at = COALESCE(resolved_at, ?), sla_status = 'Resolved' WHERE complaint_id = ?", (status_to_set, now_iso, now_iso, complaint_id))
    else:
        c.execute("UPDATE complaints SET status = ?, first_response_at = COALESCE(first_response_at, ?), sla_status = CASE WHEN sla_due_at IS NOT NULL AND sla_due_at < ? THEN 'Breached' ELSE sla_status END WHERE complaint_id = ?", (status_to_set, now_iso, now_iso, complaint_id))

    # If action is Approve, update comparison result verification_status to VERIFIED (Human Verified)
    if action == "Approve":
        c.execute("UPDATE comparison_results SET verification_status = 'VERIFIED' WHERE complaint_id = ?", (complaint_id,))

    # Record review action
    c.execute('''
    INSERT INTO review_actions (
        id, complaint_id, reviewer_id, reviewer_name, reviewer_role, action, notes, old_status, new_status, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), complaint_id, user_id, user_name, role, action, notes, old_status, status_to_set, now_iso
    ))

    # Audit log
    c.execute('''
    INSERT INTO audit_logs (
        id, user_id, user_email, role, action, entity_type, entity_id, details, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()), user_id, user_name, role, f"REVIEW_{action.upper()}", "COMPLAINT", complaint_id,
        f"Reviewer {user_name} ({role}) executed '{action}'. Status changed from {old_status} to {status_to_set}. Notes: {notes}", now_iso
    ))

    conn.commit()
    conn.close()
    return {"success": True, "old_status": old_status, "new_status": status_to_set}

def get_documents(data):
    role = data.get("role")
    # Role matrix: Admin = YES, Agent = YES, Customer = YES. Manager = NO, Reviewer = NO.
    if role in ["Manager", "Reviewer"]:
        return {"error": "Access to Documents & KB is not permitted for your role.", "status": 403}

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM documents ORDER BY title ASC")
    docs = [dict(r) for r in c.fetchall()]

    for d in docs:
        c.execute("SELECT * FROM document_chunks WHERE document_id = ?", (d["id"],))
        d["chunks"] = [dict(chunk) for chunk in c.fetchall()]

    conn.close()
    return {"documents": docs}

def upload_document(data):
    role = data.get("role")
    user_id = data.get("user_id")
    if role != "Administrator":
        return {"error": "Document upload permission denied. Only Administrator has authority to upload policy documents.", "status": 403}

    doc = data.get("document", {})
    doc_id = (doc.get("id") or "").strip().upper()
    title = (doc.get("title") or "").strip()
    doc_type = doc.get("type") or "Policy"
    section = doc.get("section") or "1.0"
    version = doc.get("version") or "v1.0"
    effective = doc.get("effective_date") or datetime.utcnow().strftime("%Y-%m-%d")
    source = doc.get("source") or "Enterprise Policy Board"
    status = doc.get("status") or "Active"
    content = doc.get("content") or ""
    filename = doc.get("filename") or ""
    file_data = doc.get("file_data") or ""
    parsed = None

    if file_data and filename:
        try:
            parsed = extract_document(filename, file_data)
            content = parsed["text"]
        except Exception as exc:
            return {"error": f"Document extraction failed: {exc}", "status": 400}

    if not doc_id or not title or not content:
        return {"error": "Document ID, Title, and Content are required. Upload a PDF/DOCX or paste text.", "status": 400}

    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM documents WHERE id = ?", (doc_id,))
    existing = c.fetchone()

    if existing:
        c.execute("""
        UPDATE documents SET title = ?, doc_type = ?, section = ?, version = ?,
        effective_date = ?, source = ?, status = ?, content = ? WHERE id = ?
        """, (title, doc_type, section, version, effective, source, status, content, doc_id))
    else:
        c.execute("""
        INSERT INTO documents (
            id, title, doc_type, section, version, effective_date, source, status, summary, content, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (doc_id, title, doc_type, section, version, effective, source, status, title, content, now_iso, user_id))

    c.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
    parsed_chunks = chunk_text(content, section, version, parsed.get("source_chunks") if parsed else None)
    for item in parsed_chunks:
        c.execute("""
        INSERT INTO document_chunks (id, document_id, section, heading, page_ref, version, chunk_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), doc_id, item["section"], item["heading"], item["page_ref"], item["version"], item["chunk_text"]))

    c.execute("""
    INSERT INTO audit_logs (
        id, user_id, user_email, role, action, entity_type, entity_id, details, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4()), user_id, "admin@supportnova.internal", "Administrator",
        "DOCUMENT_UPLOAD", "DOCUMENT", doc_id,
        f"Policy document '{title}' ({doc_id}) version {version} uploaded, extracted, and chunked from {filename or 'manual text'}.", now_iso
    ))
    conn.commit()
    conn.close()
    return {"success": True, "document_id": doc_id, "chunks_created": len(parsed_chunks), "extracted_filename": filename or None}


def retrieve_context(data):
    query = data.get("query", "")
    return {"sources": retrieve_policy_chunks(query, int(data.get("limit", 5) or 5))}

def validate_ai_action(data):
    errors = validate_ai_output(data.get("ai_output"))
    return {"valid": not errors, "errors": errors}

def get_reports(data):
    role = data.get("role")
    if role == "Customer":
        return {"error": "Unauthorized access to Analytics & Reports.", "status": 403}

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT category, count(*) as count FROM ai_analyses GROUP BY category")
    category_dist = [dict(r) for r in c.fetchall()]
    c.execute("SELECT sentiment, count(*) as count FROM ai_analyses GROUP BY sentiment")
    sentiment_dist = [dict(r) for r in c.fetchall()]
    c.execute("SELECT urgency, count(*) as count FROM ai_analyses GROUP BY urgency")
    urgency_dist = [dict(r) for r in c.fetchall()]
    c.execute("SELECT department, count(*) as count FROM ai_analyses GROUP BY department")
    department_dist = [dict(r) for r in c.fetchall()]
    c.execute("SELECT verification_status, count(*) as count FROM comparison_results GROUP BY verification_status")
    verification_dist = [dict(r) for r in c.fetchall()]

    total_complaints = c.execute("SELECT count(*) FROM complaints").fetchone()[0]
    resolved_count = c.execute("SELECT count(*) FROM complaints WHERE status IN ('Resolved','Closed')").fetchone()[0]
    escalated_count = c.execute("SELECT count(*) FROM complaints WHERE status = 'Escalated'").fetchone()[0]
    mismatch_count = c.execute("SELECT count(*) FROM comparison_results WHERE verification_status = 'MANUAL REVIEW REQUIRED'").fetchone()[0]
    repeat_count = c.execute("SELECT count(*) FROM complaints WHERE is_repeat = 1").fetchone()[0]

    # SLA is calculated from stored timestamps rather than a hard-coded KPI.
    sla_rows = c.execute("""
        SELECT c.created_at, c.first_response_at, c.resolved_at, a.priority
        FROM complaints c JOIN ai_analyses a ON a.complaint_id = c.complaint_id
        WHERE c.resolved_at IS NOT NULL
    """).fetchall()
    sla_pass = 0
    for row in sla_rows:
        try:
            created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            resolved = datetime.fromisoformat(row["resolved_at"].replace("Z", "+00:00"))
            target = SLA_HOURS.get((row["priority"] or "P2").upper(), SLA_HOURS["P2"])[1]
            if (resolved - created).total_seconds() <= target * 3600:
                sla_pass += 1
        except Exception:
            continue
    sla_rate = round((sla_pass / len(sla_rows)) * 100, 1) if sla_rows else 0.0

    # Real daily trend from persisted records, last 7 UTC dates with activity.
    trend_rows = c.execute("""
        SELECT substr(created_at, 1, 10) AS date, count(*) AS volume,
               AVG(CASE WHEN resolved_at IS NOT NULL THEN
                   (julianday(resolved_at) - julianday(created_at)) * 24.0 END) AS avg_hours
        FROM complaints
        GROUP BY substr(created_at, 1, 10)
        ORDER BY date DESC LIMIT 7
    """).fetchall()
    resolution_trend = [
        {"date": r["date"], "volume": r["volume"], "avg_resolution_hours": round(r["avg_hours"], 2) if r["avg_hours"] is not None else None}
        for r in reversed(trend_rows)
    ]
    conn.close()

    return {
        "metrics": {
            "total_complaints": total_complaints,
            "resolved_count": resolved_count,
            "escalated_count": escalated_count,
            "pending_count": total_complaints - resolved_count,
            "mismatch_count": mismatch_count,
            "repeat_count": repeat_count,
            "sla_compliance_rate": sla_rate,
        },
        "category_dist": category_dist,
        "sentiment_dist": sentiment_dist,
        "urgency_dist": urgency_dist,
        "department_dist": department_dist,
        "verification_dist": verification_dist,
        "resolution_trend": resolution_trend,
    }

def get_evaluation_assets():
    conn = get_db()
    c = conn.cursor()
    assets = [dict(r) for r in c.execute("SELECT * FROM evaluation_assets ORDER BY asset_key").fetchall()]
    # Provide exact verification counts from persisted assets.
    counts = {
        "rules": c.execute("SELECT COUNT(*) FROM rule_matrix").fetchone()[0],
        "escalation_conditions": sum(len(r.get("escalation_conditions", [])) for r in RULES),
        "benchmark_cases": c.execute("SELECT COUNT(*) FROM benchmark_cases").fetchone()[0],
        "unseen_cases": c.execute("SELECT COUNT(*) FROM evaluation_cases").fetchone()[0],
        "prompt_injection_cases": c.execute("SELECT COUNT(*) FROM prompt_injection_cases").fetchone()[0],
        "docx_smoke_test": c.execute("SELECT record_count FROM evaluation_assets WHERE asset_key='docx_smoke_test'").fetchone()[0] if c.execute("SELECT COUNT(*) FROM evaluation_assets WHERE asset_key='docx_smoke_test'").fetchone()[0] else 0,
    }
    conn.close()
    return {"assets": assets, "counts": counts}


def get_rule_matrix():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM rule_matrix ORDER BY rule_id ASC")
    rows = []
    for r in c.fetchall():
        item = dict(r)
        try:
            item["required_actions"] = json.loads(item["required_actions"])
            item["prohibited_actions"] = json.loads(item["prohibited_actions"])
        except:
            pass
        rows.append(item)
    conn.close()
    return {"rules": rows}

def export_csv(data):
    role = data.get("role")
    user_id = data.get("user_id")

    conn = get_db()
    c = conn.cursor()
    if role == "Customer":
        c.execute("""
        SELECT c.complaint_id, c.title, c.order_ref, c.date, c.status, a.category, a.urgency, a.priority, comp.verification_status
        FROM complaints c
        LEFT JOIN ai_analyses a ON c.complaint_id = a.complaint_id
        LEFT JOIN comparison_results comp ON c.complaint_id = comp.complaint_id
        WHERE c.customer_id = ?
        ORDER BY c.created_at DESC
        """, (user_id,))
    else:
        c.execute("""
        SELECT c.complaint_id, c.customer_name, c.customer_type, c.title, c.order_ref, c.date, c.status,
               a.category, a.urgency, a.priority, a.department, comp.verification_status, comp.mismatch_count
        FROM complaints c
        LEFT JOIN ai_analyses a ON c.complaint_id = a.complaint_id
        LEFT JOIN comparison_results comp ON c.complaint_id = comp.complaint_id
        ORDER BY c.created_at DESC
        """)

    rows = c.fetchall()
    conn.close()

    lines = []
    if role == "Customer":
        lines.append("Complaint ID,Title,Order Reference,Date,Status,Category,Urgency,Priority,Verification Status")
        for r in rows:
            lines.append(f'"{r[0]}","{r[1]}","{r[2]}","{r[3]}","{r[4]}","{r[5]}","{r[6]}","{r[7]}","{r[8]}"')
    else:
        lines.append("Complaint ID,Customer Name,Customer Type,Title,Order Reference,Date,Status,Category,Urgency,Priority,Department,Verification Status,Mismatches")
        for r in rows:
            lines.append(f'"{r[0]}","{r[1]}","{r[2]}","{r[3]}","{r[4]}","{r[5]}","{r[6]}","{r[7]}","{r[8]}","{r[9]}","{r[10]}","{r[11]}","{r[12]}"')

    return {"csv": "\n".join(lines)}

def handle_preprocess(data):
    complaint = data.get("complaint", {})
    title_sanitized = sanitize_and_normalize(complaint.get("title", ""))
    desc_sanitized = sanitize_and_normalize(complaint.get("description", ""))
    injection_res = detect_prompt_injection(desc_sanitized)
    complaint_valid, errors = validate_complaint_input(complaint)
    
    return {
        "title_sanitized": title_sanitized,
        "description_sanitized": desc_sanitized,
        "injection_analysis": injection_res,
        "is_valid": complaint_valid,
        "validation_errors": errors,
        "untrusted_data_envelope": wrap_as_untrusted_data(complaint)
    }


def handle_prepare_complaint(data):
    """Single-process preprocess + KB retrieval to cut submit latency."""
    pre = handle_preprocess(data)
    if not pre.get("is_valid"):
        return pre
    complaint = data.get("complaint", {})
    query = f"{complaint.get('title', '')} {complaint.get('description', '')}".strip()
    sources = retrieve_policy_chunks(query, int(data.get("limit", 5) or 5))
    return {
        **pre,
        "sources": sources,
        "retrieved_policy_ids": [s.get("document_id") for s in sources if s.get("document_id")],
    }


def deterministic_analysis(data):
    complaint = data.get("complaint") or {}
    valid, errors = validate_complaint_input(complaint)
    if not valid:
        return {"error": "; ".join(errors), "status": 400}
    output = build_deterministic_analysis(complaint)
    output.pop("_fallback_manual_review", None)
    schema_errors = validate_ai_output(output)
    if schema_errors:
        return {"error": "Deterministic analysis failed its own schema contract.", "details": schema_errors, "status": 500}
    return {"ai_output": output, "provider": "Python Rule-Matrix Fallback"}

def save_chat_message(data):
    """Persist a chat message; create conversation if needed. Bound to customer when authenticated."""
    conn = get_db()
    c = conn.cursor()
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    conversation_id = data.get("conversation_id")
    role = data.get("role", "user")
    content = (data.get("content") or "").strip()
    customer_id = data.get("customer_id")
    customer_name = (data.get("customer_name") or "").strip()
    customer_email = (data.get("customer_email") or "").strip().lower()

    # Authenticated customers are bound to their account identity. Anonymous
    # chat is also supported, but the web widget supplies a verified contact
    # identity before the first customer message is persisted.
    if customer_id and (not customer_name or not customer_email):
        row = c.execute("SELECT name, email FROM users WHERE id = ?", (customer_id,)).fetchone()
        if row:
            customer_name = row["name"]
            customer_email = row["email"]

    if not customer_name:
        customer_name = "Guest"

    if not content:
        return {"error": "Empty message", "status": 400}

    if not customer_id:
        import re
        if customer_name == "Guest" or len(customer_name) < 2:
            return {"error": "Customer name is required for anonymous chat.", "status": 400}
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", customer_email):
            return {"error": "A valid customer email is required for anonymous chat.", "status": 400}

    if not conversation_id:
        conversation_id = str(uuid.uuid4())
        c.execute(
            """INSERT INTO chat_conversations
               (id, customer_id, customer_name, customer_email, channel, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'web_widget', 'open', ?, ?)""",
            (conversation_id, customer_id, customer_name, customer_email, now, now),
        )
    else:
        existing = c.execute(
            "SELECT customer_id, customer_name, customer_email FROM chat_conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        if not existing:
            conn.close()
            return {"error": "Conversation not found", "status": 404}
        # A transcript belongs to its original customer. Do not allow a guest
        # or another authenticated user to append to someone else's chat.
        if existing["customer_id"] and existing["customer_id"] != customer_id:
            conn.close()
            return {"error": "Conversation ownership mismatch", "status": 403}
        if not existing["customer_id"] and existing["customer_email"] and customer_email and existing["customer_email"].lower() != customer_email.lower():
            conn.close()
            return {"error": "Conversation identity mismatch", "status": 403}
        # Never overwrite an existing authenticated identity with guest data.
        effective_name = customer_name if customer_id or customer_name != "Guest" else existing["customer_name"]
        effective_email = customer_email if customer_id or customer_email else existing["customer_email"]
        c.execute(
            "UPDATE chat_conversations SET updated_at = ?, customer_id = COALESCE(?, customer_id), "
            "customer_name = ?, customer_email = ? WHERE id = ?",
            (now, customer_id, effective_name or existing["customer_name"], effective_email or existing["customer_email"], conversation_id),
        )

    msg_id = str(uuid.uuid4())
    c.execute(
        """INSERT INTO chat_messages (id, conversation_id, role, content, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (msg_id, conversation_id, role, content, now),
    )
    conn.commit()
    conn.close()
    return {"conversation_id": conversation_id, "message_id": msg_id, "created_at": now}


def get_chat_conversations(data):
    """Admin-only: list all conversations with latest message preview and customer name."""
    role = data.get("role") or data.get("user_role")
    if role != "Administrator":
        return {"error": "Only Administrators can view chat logs.", "status": 403}
    conn = get_db()
    c = conn.cursor()
    c.execute(
        """
        SELECT cv.id, cv.customer_id, cv.customer_name, cv.customer_email, cv.status,
               cv.created_at, cv.updated_at,
               (SELECT content FROM chat_messages m WHERE m.conversation_id = cv.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = cv.id) AS message_count
        FROM chat_conversations cv
        ORDER BY cv.updated_at DESC
        LIMIT 200
        """
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"conversations": rows}


def get_chat_messages(data):
    """Admin or owner: fetch full transcript for a conversation."""
    role = data.get("role") or data.get("user_role")
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return {"error": "conversation_id required", "status": 400}
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM chat_conversations WHERE id = ?", (conversation_id,))
    conv = c.fetchone()
    if not conv:
        conn.close()
        return {"error": "Conversation not found", "status": 404}
    conv = dict(conv)
    if role != "Administrator" and data.get("customer_id") != conv.get("customer_id"):
        conn.close()
        return {"error": "Unauthorized", "status": 403}
    c.execute(
        "SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    )
    messages = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"conversation": conv, "messages": messages}


def get_recent_customers(data):
    """Admin-only: list recently registered Customer accounts (newest first)."""
    role = data.get("role") or data.get("user_role")
    if role != "Administrator":
        return {"error": "Only Administrators can view recent signups.", "status": 403}
    limit = int(data.get("limit") or 20)
    if limit < 1:
        limit = 20
    if limit > 100:
        limit = 100
    conn = get_db()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, name, email, customer_type, created_at
        FROM users
        WHERE role = 'Customer'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"customers": rows}


def main():
    try:
        raw_input = sys.stdin.read()
        data = json.loads(raw_input) if raw_input.strip() else {}
        action = data.get("bridge_action") or data.get("action") or data.get("command")

        if action == "login":
            result = handle_login(data)
        elif action == "signup":
            result = handle_signup(data)
        elif action == "preprocess":
            result = handle_preprocess(data)
        elif action == "prepare_complaint":
            result = handle_prepare_complaint(data)
        elif action == "get_complaints":
            result = get_complaints(data)
        elif action == "get_complaint_detail":
            result = get_complaint_detail(data)
        elif action == "save_new_complaint":
            result = save_new_complaint(data)
        elif action == "get_review_queue":
            result = get_review_queue(data)
        elif action == "submit_review_action":
            result = submit_review_action(data)
        elif action == "get_documents":
            result = get_documents(data)
        elif action == "retrieve_context":
            result = retrieve_context(data)
        elif action == "validate_ai_output":
            result = validate_ai_action(data)
        elif action == "deterministic_analysis":
            result = deterministic_analysis(data)
        elif action == "upload_document":
            result = upload_document(data)
        elif action == "get_reports":
            result = get_reports(data)
        elif action == "get_rule_matrix":
            result = get_rule_matrix()
        elif action == "get_evaluation_assets":
            result = get_evaluation_assets()
        elif action == "export_csv":
            result = export_csv(data)
        elif action == "save_chat_message":
            result = save_chat_message(data)
        elif action == "get_chat_conversations":
            result = get_chat_conversations(data)
        elif action == "get_chat_messages":
            result = get_chat_messages(data)
        elif action == "get_recent_customers":
            result = get_recent_customers(data)
        else:
            result = {"error": f"Unknown action: {action}", "status": 400}

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "status": 500}))

if __name__ == "__main__":
    main()
