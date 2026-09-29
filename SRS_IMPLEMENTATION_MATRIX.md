# SupportNova SRS Implementation Matrix

| Area | Previous state | Implemented in this build | Status |
|---|---|---|---|
| Python ground-truth validation | Present | Independent rule validation now enforces schema, active-policy metadata, required/prohibited actions, escalation, and traceability | Implemented |
| PDF/DOCX ingestion | Manual text only | Browser file upload + Python PDF/DOCX extraction + traceable chunks | Implemented |
| Knowledge retrieval | Stored chunks, no retrieval grounding | Active-policy retrieval with optional embeddings/FAISS and deterministic fallback | Implemented |
| Rule Matrix | 16 rules | 136 persisted deterministic rules | Implemented |
| Escalation coverage | 25 conditions | 265 persisted escalation conditions | Implemented |
| Prompt-injection benchmark | Detection existed | 20-case dataset + expanded detector patterns + manual-review routing | Implemented |
| Complaint benchmark | Small demo dataset | 500-case synthetic benchmark dataset | Implemented |
| Unseen evaluation | Not present | 100-case unseen evaluation dataset + offline contract check | Implemented |
| Duplicate/repeat | Same customer/order heuristic | Similarity-based near-duplicate + repeat detection | Implemented |
| AI schema validation | JSON parsing only | Exact field/type/taxonomy validation before persistence; one controlled repair attempt | Implemented |
| SLA analytics | Hard-coded 94.2% | Persisted due/response/resolution timestamps and calculated compliance | Implemented |
| Authentication | HMAC token with fixed fallback secret/no expiry | Expiring HMAC tokens; configurable secret/TTL | Implemented |
| Audit/review | Present | Preserved; SLA timestamps added to review workflow | Implemented |
| Documentation | Generic starter README | Project README, AI_USAGE, demo script, technical blog, contribution template | Implemented |
| Automated tests | No tests folder | Python contract tests and offline evaluation check | Implemented |

## Deliberately preserved

The existing React screens, routing, role model, database-backed complaint workflow, review queue, CSV export and visual design were not replaced. Changes were additive or backend-hardening changes required to close documented gaps.

## Verification performed

- `python3 -m py_compile python_engine/*.py` — passed.
- `python3 -m unittest discover -s tests -p 'test_*.py'` — passed (9 tests).
- `python3 evaluation/run_contract_checks.py` — passed: 136 rules, 265 escalation conditions, 500 benchmark cases, 100 unseen cases, 20/20 injection cases detected.
- DOCX extraction smoke test — passed.
- Full Node/Vite build could not be executed in this environment because `npm install` timed out twice. The ZIP therefore includes the source changes and must be built in an environment where Node dependencies can finish installing.

## Workflow hardening in this build

- Deterministic fallback analysis is derived from the independent Python Rule Matrix rather than duplicated TypeScript classifications.
- The server no longer injects the AI-selected policy ID into retrieved-source IDs; policy traceability uses actual retrieval results.
- Python rejects malformed structured analysis before persistence, including direct bridge calls.
- Required resolution actions and prohibited actions are evaluated deterministically.
- Active/outdated policy metadata is read from the Knowledge Base when available, while the bundled registry remains a safe fallback.
- Existing React screens, routes, styling, and component structure were not modified.
