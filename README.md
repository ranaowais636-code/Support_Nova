# SupportNova — Complaint Resolution Intelligence

SupportNova is an enterprise complaint-intelligence application built around a **dual-pipeline architecture**:

**React UI → Express API → Python preprocessing/ground truth → Gemini analysis → independent Python validation → comparison/manual review → SQLite audit trail**

## Implemented SRS-aligned capabilities

- Role-based access control for Customer, Agent, Reviewer, Manager and Administrator.
- Complaint intake, AI classification, routing, priority/urgency analysis and professional response generation.
- Independent Python validation; GenAI output is not treated as ground truth.
- Rule-Matrix deterministic fallback for provider/API failures, explicitly labeled as Python fallback rather than GenAI output.
- 136 deterministic Rule Matrix rules with 265+ escalation conditions.
- Prompt-injection detection and untrusted-data prompt isolation.
- Strict structured-output validation plus one automatic JSON repair attempt; malformed output is rejected before persistence.
- PDF/DOCX policy ingestion, extraction, version metadata and traceable chunks; active-policy metadata participates in validation.
- Knowledge Base retrieval used to ground AI analysis.
- Duplicate/repeat detection using text similarity and customer/order history.
- SLA due-date tracking and persisted first-response/resolution timestamps.
- Manual review, reviewer override, escalation and audit logging.
- 500-case benchmark dataset, 20 prompt-injection cases and 100 unseen evaluation cases.
- Offline SRS contract tests and evaluation checks.

## Project structure

```text
python_engine/       Python ground-truth, preprocessing, validation, KB ingestion/retrieval
src/                 React application and existing UI
 data/               SRS-aligned benchmark/evaluation datasets
docs/                Demo script, technical blog and team contribution template
evaluation/          Evaluation instructions and offline checks
tests/               Automated contract tests
supportnova.db       Existing demo database (preserved)
server.ts            Express API and Gemini orchestration
AI_USAGE.md          AI model/prompt/security documentation
requirements.txt     Python runtime dependencies
```

## Run locally

### 1. Node dependencies

```bash
npm install
```

### 2. Python dependencies

```bash
python3 -m pip install -r requirements.txt
```

The optional semantic retrieval stack uses Sentence Transformers + FAISS. If those packages are unavailable, the application uses the deterministic local retrieval fallback.

### 3. Environment

Copy `.env.example` to `.env` and configure:

```text
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.8-flash
TOKEN_SECRET=replace_with_a_long_random_secret
TOKEN_TTL_SECONDS=28800
```

### 4. Start

```bash
npm run dev
```

## Validation

Python modules can be checked with:

```bash
python3 -m py_compile python_engine/*.py
python3 -m unittest discover -s tests -p 'test_*.py'
python3 evaluation/run_contract_checks.py
```

The Node/Vite build should be verified after `npm install` in the target environment.

## Notes

The existing UI, demo database and core complaint workflow were preserved. The implementation adds missing SRS capabilities around ingestion, validation, retrieval, datasets, scale of the rule matrix, SLA tracking, security and evaluation rather than replacing the application.
