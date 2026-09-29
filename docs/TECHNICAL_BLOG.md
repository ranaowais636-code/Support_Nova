# SupportNova: Dual-Pipeline Complaint Intelligence

SupportNova separates probabilistic language understanding from deterministic business enforcement. Gemini handles complaint interpretation and response drafting, while an independent Python Rule Matrix validates category, department, urgency, priority, policy reference, escalation, unsupported promises and source traceability.

The ingestion layer treats customer text as untrusted data and detects common prompt-injection patterns before the text reaches the model. Knowledge Base documents can be uploaded as PDF or DOCX, extracted, chunked and stored with document/version/page metadata. Retrieved policy chunks are supplied to the model as grounding context.

The comparison engine persists every mismatch. Invalid structured output is validated independently, repaired once, and then routed to manual review if the contract remains invalid. This preserves a human-in-the-loop path instead of silently accepting malformed or unsupported AI output.

The benchmark package contains 500 complaint records, 20 prompt-injection cases and 100 unseen evaluation cases, with explicit coverage for repeat, duplicate, multi-issue, ambiguous and contradictory-policy scenarios.
