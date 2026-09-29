"""Small offline SRS contract/evaluation check; does not call external AI services."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from python_engine.preprocess import detect_prompt_injection
from python_engine.rule_matrix import RULES

def main():
    injection_cases = [json.loads(x) for x in (ROOT / "data/prompt_injection_20.jsonl").read_text().splitlines()]
    detected = sum(detect_prompt_injection(x["text"])["is_adversarial"] for x in injection_cases)
    unseen = len((ROOT / "data/evaluation_100_unseen.jsonl").read_text().splitlines())
    complaints = len((ROOT / "data/complaints_500.jsonl").read_text().splitlines())
    escalation_conditions = sum(len(r.get("escalation_conditions", [])) for r in RULES)
    print(json.dumps({
        "rules": len(RULES), "escalation_conditions": escalation_conditions,
        "complaints": complaints, "unseen_cases": unseen,
        "prompt_injection_cases": len(injection_cases), "prompt_injection_detected": detected,
    }, indent=2))

if __name__ == "__main__":
    main()
