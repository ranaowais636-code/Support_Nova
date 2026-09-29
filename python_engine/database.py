"""
SupportNova Database Module
SQLite database manager for complaints, policies, rule matrix, validation, and audit logs.
"""
import sqlite3
import os
import json
import hashlib
import binascii
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'supportnova.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = binascii.hexlify(os.urandom(16)).decode()
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return binascii.hexlify(hashed).decode(), salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return new_hash == password_hash

def ensure_demo_users():
    demo_users = [
        ("usr-admin-01", "admin@supportnova.internal", "AdminNova#2026", "System Administrator", "Administrator", "Staff"),
        ("usr-mgr-01", "manager@supportnova.internal", "ManagerNova#2026", "Eleanor Vance", "Manager", "Staff"),
        ("usr-rev-01", "reviewer@supportnova.internal", "ReviewerNova#2026", "Marcus Sterling", "Reviewer", "Staff"),
        ("usr-agt-01", "agent@supportnova.internal", "AgentNova#2026", "Sarah Chen", "Agent", "Staff"),
        ("usr-cust-01", "customer@example.com", "Customer#2026", "David Miller", "Customer", "VIP"),
        ("usr-cust-02", "jane.doe@example.com", "Customer#2026", "Jane Doe", "Customer", "Regular"),
    ]
    conn = get_db()
    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    for user_id, email, password, name, role, customer_type in demo_users:
        # Skip expensive PBKDF2 when the demo user already exists.
        exists = conn.execute("SELECT 1 FROM users WHERE id = ? OR email = ?", (user_id, email)).fetchone()
        if exists:
            continue
        password_hash, salt = hash_password(password)
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email, password_hash, salt, name, role, customer_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, email, password_hash, salt, name, role, customer_type, now_iso),
        )
    conn.commit()
    conn.close()

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        customer_type TEXT DEFAULT 'Regular',
        created_at TEXT NOT NULL
    )
    ''')
    
    # Documents table (Knowledge Base)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        section TEXT NOT NULL,
        version TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL, -- Active, Superseded, Outdated, Draft
        summary TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL
    )
    ''')
    
    # Document Chunks
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        section TEXT NOT NULL,
        heading TEXT NOT NULL,
        page_ref TEXT,
        version TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents (id)
    )
    ''')
    
    # Rule Matrix table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS rule_matrix (
        id TEXT PRIMARY KEY,
        rule_id TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        conditions TEXT NOT NULL,
        department TEXT NOT NULL,
        urgency TEXT NOT NULL,
        priority TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        mandatory_escalation INTEGER DEFAULT 0,
        escalation_reason TEXT,
        required_actions TEXT NOT NULL, -- JSON array
        prohibited_actions TEXT NOT NULL, -- JSON array
        follow_up TEXT NOT NULL
    )
    ''')
    
    # Complaints table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        complaint_id TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        product_service TEXT NOT NULL,
        order_ref TEXT NOT NULL,
        channel TEXT NOT NULL,
        date TEXT NOT NULL,
        attachment_name TEXT,
        attachment_data TEXT,
        prev_complaint_ref TEXT,
        requested_resolution TEXT,
        status TEXT NOT NULL, -- New, Analyzed, In Progress, Awaiting Customer, Escalated, Resolved, Closed
        is_duplicate INTEGER DEFAULT 0,
        duplicate_of TEXT,
        is_repeat INTEGER DEFAULT 0,
        repeat_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES users (id)
    )
    ''')
    
    # AI Analysis results
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ai_analyses (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        raw_output TEXT NOT NULL,
        primary_issue TEXT,
        secondary_issue TEXT,
        category TEXT,
        subcategory TEXT,
        sentiment TEXT,
        urgency TEXT,
        priority TEXT,
        department TEXT,
        supporting_department TEXT,
        extracted_entities TEXT, -- JSON
        policy_id TEXT,
        policy_section TEXT,
        resolution_steps TEXT, -- JSON
        escalation_required INTEGER DEFAULT 0,
        escalation_level TEXT,
        escalation_notes TEXT,
        professional_response TEXT,
        response_type TEXT,
        follow_up_required INTEGER DEFAULT 0,
        follow_up_communication TEXT,
        agent_guidance TEXT,
        clarification_questions TEXT,
        analyzed_at TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id)
    )
    ''')
    
    # Python Ground-Truth Validations
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS python_validations (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        category_check TEXT NOT NULL, -- JSON {passed, reason, expected}
        department_check TEXT NOT NULL,
        urgency_check TEXT NOT NULL,
        priority_check TEXT NOT NULL,
        policy_check TEXT NOT NULL,
        resolution_check TEXT NOT NULL,
        escalation_check TEXT NOT NULL,
        follow_up_check TEXT NOT NULL,
        source_check TEXT NOT NULL,
        unsupported_promises TEXT, -- JSON array
        hallucinations TEXT, -- JSON array
        overall_status TEXT NOT NULL, -- PASSED, FAILED
        validation_summary TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id)
    )
    ''')
    
    # Comparison Engine Results
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS comparison_results (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        verification_status TEXT NOT NULL, -- VERIFIED, MANUAL REVIEW REQUIRED
        mismatch_count INTEGER DEFAULT 0,
        mismatches TEXT NOT NULL, -- JSON array of strings
        comparison_score REAL NOT NULL,
        decided_at TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id)
    )
    ''')
    
    # Review Queue & Actions
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS review_actions (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        reviewer_name TEXT NOT NULL,
        reviewer_role TEXT NOT NULL,
        action TEXT NOT NULL, -- Approve, Modify, Reclassify, Reassign, Escalate, Regenerate, Add Note
        notes TEXT,
        old_status TEXT,
        new_status TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (complaint_id)
    )
    ''')
    
    # Audit Trail
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL
    )
    ''')

    # SLA Configurations
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sla_configs (
        id TEXT PRIMARY KEY,
        priority TEXT UNIQUE NOT NULL,
        target_response_hours INTEGER NOT NULL,
        target_resolution_hours INTEGER NOT NULL
    )
    ''')

    # SRS evaluation/benchmark assets. These remain separate from live complaints so
    # benchmark data does not pollute operational dashboard counts or customer queues.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS benchmark_cases (
        case_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL, subcategory TEXT NOT NULL, order_ref TEXT NOT NULL,
        expected_flags TEXT NOT NULL, source TEXT NOT NULL, seed INTEGER NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluation_cases (
        case_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        expected_category TEXT NOT NULL, expected_subcategory TEXT NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prompt_injection_cases (
        case_id TEXT PRIMARY KEY, text TEXT NOT NULL, expected_adversarial INTEGER NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluation_assets (
        asset_key TEXT PRIMARY KEY, asset_name TEXT NOT NULL, asset_type TEXT NOT NULL,
        record_count INTEGER NOT NULL, status TEXT NOT NULL, details TEXT, updated_at TEXT NOT NULL
    )
    """)

    # Chat conversations (Admin-visible transcripts bound to customers)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        customer_email TEXT,
        channel TEXT DEFAULT 'web_widget',
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES users (id)
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id)
    )
    ''')

    # Lightweight migrations for SRS operational tracking. Existing databases are preserved.
    existing = {row[1] for row in cursor.execute("PRAGMA table_info(complaints)").fetchall()}
    for column, ddl in [
        ("first_response_at", "TEXT"),
        ("resolved_at", "TEXT"),
        ("sla_due_at", "TEXT"),
        ("sla_status", "TEXT"),
    ]:
        if column not in existing:
            cursor.execute(f"ALTER TABLE complaints ADD COLUMN {column} {ddl}")

    # Keep the persisted Rule Matrix synchronized with the independent Python source.
    try:
        from python_engine.rule_matrix import RULES
        for rule in RULES:
            cursor.execute("""
                INSERT INTO rule_matrix (
                    id, rule_id, category, subcategory, conditions, department, urgency, priority,
                    policy_id, mandatory_escalation, escalation_reason, required_actions, prohibited_actions, follow_up
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(rule_id) DO UPDATE SET
                    category=excluded.category, subcategory=excluded.subcategory, conditions=excluded.conditions,
                    department=excluded.department, urgency=excluded.urgency, priority=excluded.priority,
                    policy_id=excluded.policy_id, mandatory_escalation=excluded.mandatory_escalation,
                    escalation_reason=excluded.escalation_reason, required_actions=excluded.required_actions,
                    prohibited_actions=excluded.prohibited_actions, follow_up=excluded.follow_up
            """, (
                rule.get("rule_id"), rule.get("rule_id"), rule.get("category"), rule.get("subcategory"),
                json.dumps(rule.get("keywords", []) + rule.get("escalation_conditions", [])),
                rule.get("department"), rule.get("default_urgency"), rule.get("default_priority"),
                rule.get("policy_id"), 1 if rule.get("mandatory_escalation") else 0, rule.get("escalation_reason", ""),
                json.dumps(rule.get("required_actions", [])), json.dumps(rule.get("prohibited_actions", [])), rule.get("follow_up", "")
            ))
    except Exception:
        # Database initialization must remain usable even if an optional matrix import is unavailable.
        pass

    conn.commit()
    conn.close()

def sync_rule_matrix():
    """Public helper used by the API bridge to synchronize the persisted matrix."""
    init_db()

if __name__ == '__main__':
    init_db()
    print("Database schema initialized successfully.")
