# SupportNova AI Usage

## Model
- Provider: Google Gemini
- Model: configured by `GEMINI_MODEL` (default `gemini-3.5-flash`)
- Prompt version: `PROMPT_V1_2`
- Temperature: 0.1 for primary analysis; 0 for JSON repair

## Pipeline
1. Customer input is normalized and checked for prompt-injection patterns.
2. Complaint text is wrapped as untrusted data.
3. Active Knowledge Base chunks are retrieved and inserted as grounding context.
4. Gemini produces strict JSON.
5. Python validates the JSON schema independently.
6. One repair attempt is made if the JSON contract is invalid.
7. The Python Rule Matrix remains authoritative for routing, priority, escalation, policy validity, and unsupported promises.
8. Mismatches are persisted and routed to manual review.

## Security
- Customer text is never treated as system instructions.
- Tokens are signed with HMAC and expire after the configured TTL.
- The application does not use GenAI output as ground truth.
- Policy source metadata is retained with document chunks for traceability.

## Fallback
If Gemini is unavailable or produces invalid output after repair, SupportNova uses an explicitly labeled Python Rule-Matrix fallback. The fallback is validated by the same schema and ground-truth pipeline; unknown/unconfigured cases remain reviewable rather than being presented as GenAI classifications.
