"""Non-destructive demo complaints and chat transcripts for local demonstrations."""
import json
import uuid
from datetime import datetime, timedelta
from python_engine.database import get_db


DEMO_COMPLAINTS = [
    ("CMP-DEMO-201", "usr-cust-01", "David Miller", "VIP", "Express delivery missed promised date", "The laptop was promised for Monday, but tracking has not moved from the regional hub for four days.", "Business Laptop Pro", "ORD-DEMO-201", "Delivery", "Delayed Delivery", "High", "P1", "Logistics", "DEL-POL-04", False, "In Progress"),
    ("CMP-DEMO-202", "usr-cust-02", "Jane Doe", "Regular", "Replacement phone arrived with a cracked screen", "The replacement handset arrived today with a cracked display and cannot be safely used.", "Smartphone X12", "ORD-DEMO-202", "Product Defect", "Physical Damage", "High", "P1", "Returns", "RET-POL-02", True, "Escalated"),
    ("CMP-DEMO-203", "usr-cust-01", "David Miller", "VIP", "Duplicate charge on monthly invoice", "Our card was charged twice for the same subscription invoice. Please reverse the duplicate transaction.", "Business Cloud Suite", "INV-DEMO-203", "Billing", "Duplicate Charge", "High", "P1", "Billing", "BIL-POL-02", False, "Analyzed"),
    ("CMP-DEMO-204", "usr-cust-02", "Jane Doe", "Regular", "Wireless charger stopped working after one week", "The charger worked for seven days and now shows no power light with any compatible device.", "Wireless Charging Pad", "ORD-DEMO-204", "Product Defect", "Device Failure", "Medium", "P2", "Technical Support", "TEC-SOP-03", False, "In Progress"),
    ("CMP-DEMO-205", "usr-cust-01", "David Miller", "VIP", "Refund requested for undelivered grocery order", "The order was marked delivered, but no parcel was received at the address or with nearby neighbors.", "Fresh Grocery Delivery", "ORD-DEMO-205", "Delivery", "Marked Delivered Not Received", "High", "P1", "Logistics", "DEL-POL-04", True, "Escalated"),
    ("CMP-DEMO-206", "usr-cust-02", "Jane Doe", "Regular", "Refund still pending after approved return", "The returned headphones were received two weeks ago, but the approved refund has not reached my card.", "Noise-Canceling Headphones", "ORD-DEMO-206", "Refund", "Refund Pending", "Medium", "P2", "Billing", "REF-POL-01", False, "In Progress"),
    ("CMP-DEMO-207", "usr-cust-01", "David Miller", "VIP", "Account locked after repeated verification attempts", "My account is locked after several failed verification codes and I need access before a scheduled order dispatch.", "SupportNova Account", "ACC-DEMO-207", "Privacy", "Account Access", "High", "P1", "Account Security", "SEC-POL-05", True, "Escalated"),
    ("CMP-DEMO-208", "usr-cust-02", "Jane Doe", "Regular", "Delivered furniture has missing screws", "The table arrived on time, but the hardware pack is missing four screws needed for assembly.", "Oak Dining Table", "ORD-DEMO-208", "Returns", "Missing Parts", "Low", "P3", "Returns", "RET-POL-02", False, "Analyzed"),
    ("CMP-DEMO-209", "usr-cust-01", "David Miller", "VIP", "Third request for unresolved installation visit", "Two scheduled installation visits were missed and the replacement appointment has not been confirmed.", "Home Security Installation", "ORD-DEMO-209", "Customer Relations", "Missed Service Appointment", "Critical", "P0", "Management Escalations", "ESC-POL-07", True, "Escalated"),
    ("CMP-DEMO-210", "usr-cust-02", "Jane Doe", "Regular", "Product received in the wrong color", "The blue item ordered was replaced with a red model. The product is unused and ready for return.", "Wireless Keyboard", "ORD-DEMO-210", "Returns", "Incorrect Item", "Low", "P3", "Returns", "RET-POL-02", False, "Resolved"),
]

DEMO_CHATS = [
    ("CHAT-DEMO-201", "usr-cust-01", "David Miller", "customer@example.com", "delivery delay", [
        ("user", "My laptop delivery is four days late and tracking has not changed."),
        ("bot", "I can help with that. Please share the order reference so I can check the delivery case."),
        ("user", "The reference is ORD-DEMO-201."),
        ("bot", "Thank you. I have recorded the delayed delivery and routed it to Logistics for an SLA update."),
    ]),
    ("CHAT-DEMO-202", "usr-cust-02", "Jane Doe", "jane.doe@example.com", "damaged replacement", [
        ("user", "The replacement phone arrived with a cracked screen."),
        ("bot", "I am sorry the replacement arrived damaged. Please keep the packaging and photos for the return review."),
        ("user", "I have photos and the order is ORD-DEMO-202."),
        ("bot", "The case is recorded and escalated to Returns because the item is unsafe to use."),
    ]),
    ("CHAT-DEMO-203", "usr-cust-01", "David Miller", "customer@example.com", "duplicate billing", [
        ("user", "My subscription invoice was charged twice."),
        ("bot", "I can log a duplicate-charge review. Please provide the invoice reference."),
        ("user", "It is INV-DEMO-203."),
        ("bot", "The billing case has been recorded for transaction verification and refund processing."),
    ]),
    ("CHAT-DEMO-204", "usr-cust-02", "Jane Doe", "jane.doe@example.com", "refund pending", [
        ("user", "My approved refund has not arrived after two weeks."),
        ("bot", "I will record the refund-pending issue and request a payment-status update."),
        ("user", "The order reference is ORD-DEMO-206."),
        ("bot", "Thank you. Billing will review the refund timeline under the active refund policy."),
    ]),
    ("CHAT-DEMO-205", "usr-cust-01", "David Miller", "customer@example.com", "account access", [
        ("user", "My account is locked after verification attempts."),
        ("bot", "For account safety, I will route this to Account Security. Please do not share verification codes here."),
        ("user", "Understood. I need access before my order dispatches."),
        ("bot", "The account-access case has been escalated for identity verification and urgent review."),
    ]),
    ("CHAT-DEMO-206", "usr-cust-02", "Jane Doe", "jane.doe@example.com", "missing product parts", [
        ("user", "My table arrived but the assembly screws are missing."),
        ("bot", "I can record a missing-parts request. Please keep the item unused while the parts check is completed."),
        ("user", "The order is ORD-DEMO-208."),
        ("bot", "The request is recorded with Returns for replacement hardware dispatch."),
    ]),
]


def ensure_demo_data():
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow()

    for index, record in enumerate(DEMO_COMPLAINTS):
        complaint_id, customer_id, customer_name, customer_type, title, description, product, order_ref, category, subcategory, urgency, priority, department, policy_id, escalated, status = record
        if cursor.execute("SELECT 1 FROM complaints WHERE complaint_id = ?", (complaint_id,)).fetchone():
            continue
        created_at = (now - timedelta(days=10 - index)).strftime("%Y-%m-%dT%H:%M:%SZ")
        cursor.execute("""INSERT INTO complaints
            (id, complaint_id, customer_id, customer_name, customer_type, title, description,
             product_service, order_ref, channel, date, status, is_duplicate, is_repeat, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)""", (
            str(uuid.uuid4()), complaint_id, customer_id, customer_name, customer_type, title, description,
            product, order_ref, "Chatbot", created_at[:10], status, created_at,
        ))
        cursor.execute("""INSERT INTO ai_analyses
            (id, complaint_id, prompt_version, provider, model, raw_output, primary_issue,
             category, subcategory, sentiment, urgency, priority, department, policy_id, policy_section,
             resolution_steps, escalation_required, escalation_level, escalation_notes,
             professional_response, response_type, follow_up_required, follow_up_communication,
             agent_guidance, clarification_questions, analyzed_at)
            VALUES (?, ?, 'PROMPT_V1_2', 'Demo Policy Engine', 'verified-demo', ?, ?, ?, ?, 'Negative', ?, ?, ?, ?, '1.1', ?, ?, ?, ?, ?, 'Formal Acknowledgment', 1, 'Update customer within SLA', ?, 'None', ?)""", (
            str(uuid.uuid4()), complaint_id, json.dumps({"demo": True, "policy_id": policy_id}), title,
            category, subcategory, urgency, priority, department, policy_id,
            json.dumps(["Verify order record", "Apply active policy", "Provide documented resolution"]),
            1 if escalated else 0, "Supervisor Review" if escalated else "No Escalation",
            "Escalated under active safety, security, repeat-service, or delivery policy." if escalated else "Standard policy workflow.",
            f"Dear {customer_name}, your {product} case {complaint_id} is being reviewed under {policy_id}.",
            "Confirm order and customer details before final resolution.", created_at,
        ))
        cursor.execute("""INSERT INTO python_validations
            (id, complaint_id, category_check, department_check, urgency_check, priority_check,
             policy_check, resolution_check, escalation_check, follow_up_check, source_check,
             overall_status, validation_summary, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PASSED', ?, ?)""", (
            str(uuid.uuid4()), complaint_id,
            json.dumps({"passed": True, "reason": "Category matches rule matrix"}),
            json.dumps({"passed": True, "reason": f"Routed to {department}"}),
            json.dumps({"passed": True, "reason": f"Urgency verified as {urgency}"}),
            json.dumps({"passed": True, "reason": f"Priority verified as {priority}"}),
            json.dumps({"passed": True, "reason": f"Active policy {policy_id} verified"}),
            json.dumps({"passed": True, "reason": "Resolution follows active policy"}),
            json.dumps({"passed": True, "reason": "Escalation evaluated deterministically"}),
            json.dumps({"passed": True, "reason": "Follow-up schedule recorded"}),
            json.dumps({"passed": True, "reason": "Demo record source verified"}),
            "Demo complaint passed deterministic policy validation.", created_at,
        ))
        cursor.execute("""INSERT INTO comparison_results
            (id, complaint_id, verification_status, mismatch_count, mismatches, comparison_score, decided_at)
            VALUES (?, ?, 'VERIFIED', 0, '[]', 100.0, ?)""", (str(uuid.uuid4()), complaint_id, created_at))

    for conversation_id, customer_id, customer_name, customer_email, topic, messages in DEMO_CHATS:
        if cursor.execute("SELECT 1 FROM chat_conversations WHERE id = ?", (conversation_id,)).fetchone():
            continue
        created_at = (now - timedelta(days=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
        cursor.execute("""INSERT INTO chat_conversations
            (id, customer_id, customer_name, customer_email, channel, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'web_widget', 'resolved', ?, ?)""", (
            conversation_id, customer_id, customer_name, customer_email, created_at, created_at,
        ))
        for message_index, (role, content) in enumerate(messages):
            timestamp = (now - timedelta(days=6) + timedelta(minutes=message_index * 3)).strftime("%Y-%m-%dT%H:%M:%SZ")
            cursor.execute("""INSERT INTO chat_messages
                (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)""", (
                f"{conversation_id}-{message_index + 1}", conversation_id, role, content, timestamp,
            ))

    conn.commit()
    conn.close()


if __name__ == "__main__":
    ensure_demo_data()
