"""
SupportNova Python CLI bridge for Express Server
Accepts JSON input via stdin or command-line arguments and returns validation & comparison output.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from python_engine.validate import validate_genai_output
from python_engine.preprocess import sanitize_and_normalize, detect_prompt_injection, validate_complaint_input, wrap_as_untrusted_data

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)
            
        data = json.loads(raw_input)
        command = data.get("command", "validate")
        
        if command == "preprocess":
            complaint = data.get("complaint", {})
            title_sanitized = sanitize_and_normalize(complaint.get("title", ""))
            desc_sanitized = sanitize_and_normalize(complaint.get("description", ""))
            injection_res = detect_prompt_injection(desc_sanitized)
            complaint_valid, errors = validate_complaint_input(complaint)
            
            output = {
                "title_sanitized": title_sanitized,
                "description_sanitized": desc_sanitized,
                "injection_analysis": injection_res,
                "is_valid": complaint_valid,
                "validation_errors": errors,
                "untrusted_data_envelope": wrap_as_untrusted_data(complaint)
            }
            print(json.dumps(output))
            
        elif command == "validate":
            complaint = data.get("complaint", {})
            ai_output = data.get("ai_output", {})
            result = validate_genai_output(complaint, ai_output)
            print(json.dumps(result))
            
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
