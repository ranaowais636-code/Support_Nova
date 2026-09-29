import json
import os
import unittest
from python_engine.preprocess import detect_prompt_injection
from python_engine.schema import validate_ai_output
from python_engine.rule_matrix import RULES
from python_engine.validate import validate_genai_output
from python_engine.deterministic_analysis import build_deterministic_analysis
from python_engine.api_bridge import save_chat_message, get_chat_conversations, get_chat_messages

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VALID = {
    "primary_issue": "Test", "secondary_issue": None, "issue_category": "Delivery",
    "subcategory": "Delayed Delivery", "sentiment": "Negative", "urgency": "Medium", "priority": "P2",
    "department": "Logistics", "supporting_department": None, "policy_id": "DEL-POL-04", "policy_section": "5.2",
    "resolution_steps": ["Verify tracking"], "escalation_required": False, "escalation_level": "No Escalation",
    "escalation_notes": "None", "professional_response": "We will investigate.", "response_type": "Update",
    "follow_up_required": True, "follow_up_communication": "Within SLA", "agent_guidance": "Verify records",
    "clarification_questions": None,
}

class SRSContractTests(unittest.TestCase):
    def test_rule_matrix_scale(self):
        self.assertGreaterEqual(len(RULES), 100)
        self.assertGreaterEqual(sum(len(r.get("escalation_conditions", [])) for r in RULES), 30)

    def test_schema_accepts_valid_payload(self):
        self.assertEqual(validate_ai_output(VALID), [])

    def test_schema_rejects_missing_field(self):
        payload = dict(VALID)
        payload.pop("policy_id")
        self.assertTrue(validate_ai_output(payload))

    def test_prompt_injection_dataset(self):
        path = os.path.join(ROOT, "data", "prompt_injection_20.jsonl")
        with open(path, encoding="utf-8") as f:
            cases = [json.loads(line) for line in f]
        self.assertEqual(len(cases), 20)
        self.assertTrue(all(detect_prompt_injection(c["text"])["is_adversarial"] for c in cases))

    def test_python_escalation_is_authoritative(self):
        cases = [
            ({"title": "Safety", "description": "The battery is swollen and smoking"}, "Safety", True),
            ({"title": "Legal", "description": "My attorney will take this to court"}, "Customer Relations", True),
            ({"title": "Delivery", "description": "The package is delayed 8 days"}, "Delivery", True),
            ({"title": "Billing", "description": "I was charged twice for $1500"}, "Billing", True),
        ]
        for complaint, ai_category, expected in cases:
            ai = dict(VALID)
            ai["issue_category"] = ai_category
            ai["escalation_required"] = False
            result = validate_genai_output(complaint, ai)
            self.assertEqual(result["escalation_check"]["python_authoritative_decision"], expected)
            self.assertEqual(result["escalation_check"]["genai_value"], False)
            self.assertEqual(result["verification_status"], "MANUAL REVIEW REQUIRED")

    def test_benchmark_size(self):
        for name, expected in [("complaints_500.jsonl", 500), ("evaluation_100_unseen.jsonl", 100)]:
            with open(os.path.join(ROOT, "data", name), encoding="utf-8") as f:
                self.assertEqual(sum(1 for _ in f), expected)

    def test_deterministic_fallback_is_rule_matrix_grounded(self):
        complaint = {
            "title": "Package delayed",
            "description": "My package has been delayed for 8 days and I still have not received it.",
            "order_ref": "ORD-REG-001",
            "product_service": "Laptop",
        }
        output = build_deterministic_analysis(complaint)
        self.assertEqual(output["issue_category"], "Delivery")
        self.assertEqual(output["subcategory"], "Delayed Delivery")
        self.assertEqual(output["department"], "Logistics")
        self.assertEqual(output["urgency"], "Medium")
        self.assertEqual(output["priority"], "P2")
        self.assertTrue(output["escalation_required"])
        output.pop("_fallback_manual_review", None)
        self.assertEqual(validate_ai_output(output), [])

    def test_required_actions_are_enforced(self):
        complaint = {
            "title": "Delayed delivery",
            "description": "The shipment is delayed and overdue.",
            "order_ref": "ORD-REG-002",
        }
        output = build_deterministic_analysis(complaint)
        output["resolution_steps"] = ["Please wait."]
        result = validate_genai_output(complaint, output)
        self.assertFalse(result["resolution_check"]["passed"])
        self.assertTrue(result["resolution_check"]["missing_required_actions"])

    def test_policy_traceability_cannot_be_fabricated(self):
        complaint = {
            "title": "Delayed delivery",
            "description": "The shipment is delayed and overdue.",
            "order_ref": "ORD-REG-003",
            "retrieved_policy_ids": ["BIL-POL-02"],
        }
        output = build_deterministic_analysis(complaint)
        output["policy_id"] = "BIL-POL-02"
        result = validate_genai_output(complaint, output)
        self.assertTrue(result["policy_check"]["passed"])
        self.assertTrue(any("policy preference mismatch" in x.lower() for x in result["mismatches"]))
        self.assertEqual(result["verification_status"], "MANUAL REVIEW REQUIRED")


    def test_chat_identity_is_persisted_and_admin_traceable(self):
        created = save_chat_message({
            "conversation_id": None,
            "role": "user",
            "content": "How can I submit a complaint about my order?",
            "customer_name": "Test Customer",
            "customer_email": "test.customer@example.com",
        })
        self.assertIn("conversation_id", created)
        conversation_id = created["conversation_id"]

        save_chat_message({
            "conversation_id": conversation_id,
            "role": "bot",
            "content": "Please use the Submit Complaint page.",
            "customer_name": "Test Customer",
            "customer_email": "test.customer@example.com",
        })
        rows = get_chat_conversations({"role": "Administrator"})["conversations"]
        row = next(item for item in rows if item["id"] == conversation_id)
        self.assertEqual(row["customer_name"], "Test Customer")
        self.assertEqual(row["customer_email"], "test.customer@example.com")
        self.assertEqual(row["message_count"], 2)

        transcript = get_chat_messages({"role": "Administrator", "conversation_id": conversation_id})
        self.assertEqual(len(transcript["messages"]), 2)

        # Anonymous identity is required and cannot be silently stored as Guest.
        invalid = save_chat_message({"role": "user", "content": "FAQ only"})
        self.assertEqual(invalid["status"], 400)

        conn = __import__("python_engine.database", fromlist=["get_db"]).get_db()
        conn.execute("DELETE FROM chat_messages WHERE conversation_id = ?", (conversation_id,))
        conn.execute("DELETE FROM chat_conversations WHERE id = ?", (conversation_id,))
        conn.commit()
        conn.close()


if __name__ == "__main__":
    unittest.main()

