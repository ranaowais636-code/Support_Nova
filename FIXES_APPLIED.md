# SupportNova – Fixes Applied

## Chatbot & multi-agent enhancements (session, intake, multi-modal)
- **Auth / session loop fixed:** `ChatbotWidget` now receives `currentUser` and reads the stored session token on load. Logged-in Customer sessions no longer hit a login wall; complaint submit uses the existing Bearer token. Guests still get a clear login prompt only when submission requires it.
- **Multi-agent chat backend:** New `POST /api/chat/query` orchestrates knowledge_retrieval (Python KB retrieve), policy_checker, and ticket_router agents, then synthesizes a reply via Gemini when configured (deterministic fallback otherwise). Frontend `api.chatQuery` wires the widget to this endpoint for non-FAQ free-text questions.
- **FAQs preserved:** Existing `FAQ_OPTIONS` and `FAQ_ANSWERS` text and structure are unchanged.
- **Conversational complaint filing:** Saying “file a complaint” starts a guided 5-step flow (title → description → order_ref → category → product/service → confirm) and submits via `api.submitComplaint` into the central pipeline/database when authenticated as Customer.
- **Image upload:** Non-intrusive paperclip control attaches image/PDF (max 4 MB) into the chat / complaint draft without changing theme or layout.
- **Voice-to-text:** Microphone control uses the Web Speech API where available; transcript fills the chat input box.
- UI theme (Neon Lime tokens, fonts, panel layout) and core workflow remain unchanged.

## Review workflow
- Fixed the bridge payload collision that caused `Unknown action: Escalate`.
- The Express route now keeps `submit_review_action` as the bridge command and passes the reviewer choice separately as `review_action`.
- Added explicit support for `Escalate`, `Resolve`, `Approve`, `Modify`, `Reclassify`, `Reassign`, `Regenerate`, and `Add Note`.
- Escalate now transitions the complaint to `Escalated` and Resolve transitions it to `Resolved`.
- Audit/review action logging remains enabled.

## SRS evaluation data
The following assets are now loaded into SQLite during application initialization, while remaining separate from live complaint volume:
- 136 Rule Matrix rules
- 265 escalation conditions
- 500 benchmark complaint cases
- 100 unseen evaluation cases
- 20 prompt-injection cases
- 1 bundled DOCX extraction smoke-test fixture

The Reports screen now displays the persisted SRS verification asset counts.

## DOCX smoke test
- Added `data/sample_policy.docx`.
- Added `data/docx_extraction_smoke_test.json`.
- The application imports the bundled DOCX through the same extraction/chunking pipeline used for uploaded documents and stores the extracted document/chunks in the Knowledge Base.

## Verification
- Python compilation: passed.
- SRS contract tests: 5/5 passed.
- Review action regression: Escalate and Resolve both passed against the real SQLite workflow.
- Asset verification: 136 / 265 / 500 / 100 / 20 / 1 loaded successfully.
- Frontend production build was not run because `node_modules` is not installed in the supplied environment; a prior `npm install` attempt timed out.

## FAQ, chat history & admin signup monitoring (this update)
- **Official FAQ data:** Replaced chatbot `FAQ_OPTIONS` / `FAQ_ANSWERS` with the six official SupportNova FAQ Q&A pairs (exact wording). Fallback chat prompt updated accordingly.
- **Admin chat logs:** Conversations list and transcript header already surface customer full name and email; search covers name, email, and message text; copy updated to state this explicitly.
- **New user signup monitoring:** Admin dashboard shows a "New Customer Signups" feed (name, email, type, timestamp). Backed by `get_recent_customers` (Python), `GET /api/admin/recent-customers` (Express), and `api.getRecentCustomers` (frontend). Admin-only.
- Theme (Neon Lime tokens), fonts, and core workflows unchanged.

## UI polish pass
- Refined Features, Workflow, and Reviews cards with premium spacing, borders, accents, and hover states.
- Changed “How SupportNova Works” to a responsive grid with a maximum of 3 cards per row on laptop/desktop.
- Added local professional avatar illustrations to customer/enterprise testimonials; TechCorp Support Lead displays as “Enterprise Support Lead”.
- FAQ chips in the customer chatbot now remain available after every FAQ click instead of disappearing after the first few messages.
- Reworked chatbot sizing/FAQ placement for desktop, tablet, and mobile so the message area, FAQs, and input remain usable together.
- Made the authenticated app shell responsive: mobile-friendly horizontal navigation, flexible main content, and reduced header density on small screens.

## Backend workflow hardening — SRS-aligned pass
- Deterministic fallback analysis now derives category, subcategory, department, urgency, priority, policy, required actions and escalation from the independent Python Rule Matrix instead of duplicating classifications in TypeScript.
- The fallback is explicitly labeled `Python Rule-Matrix Fallback`; it is never represented as a fabricated GenAI response.
- Removed the previous behavior that inserted the AI-selected policy ID into the retrieved-policy list. Source traceability now uses actual retrieval results.
- Python validates the final structured analysis before persistence, including direct bridge calls.
- Resolution validation now checks required actions, prohibited actions, and unsupported commitments.
- Policy validation reads current Knowledge Base document status/version metadata when available, while retaining the bundled policy registry as a fallback.
- The existing React UI structure was preserved; later chat/admin/avatar fixes updated only the affected presentation and data-flow components.

## Verification — current pass
- Python compilation: passed.
- SRS contract/regression tests: **10/10 passed**.
- Offline SRS asset check: **136 rules / 265 escalation conditions / 500 benchmark cases / 100 unseen cases / 20 prompt-injection cases (20/20 detected)**.
- Isolated end-to-end complaint test: **8-day delivery delay → Rule Matrix match → Medium/P2 → mandatory escalation → Python validation VERIFIED → Escalated, 100% comparison score, zero mismatches**.
- React UI source tree: existing layout/theme preserved; only the requested chat/admin/avatar components were updated in the current pass.
- Full Vite/TypeScript build: not executed because dependency installation timed out in the supplied environment; no `node_modules` or lockfile was added to the deliverable.

## Customer chat identity & review avatar fix — current update
- **Traceable FAQ conversations:** Anonymous visitors must provide a valid full name and email before sending a chatbot message or selecting an FAQ. Authenticated Customers are automatically identified from their SupportNova account.
- **Identity persistence:** Chat messages now persist `customer_name` and `customer_email` with the conversation. The backend validates anonymous identity data and prevents a different email from appending to an existing anonymous conversation.
- **Administrator visibility:** Administrator Chat Logs now show the customer's name, email, message count, latest message, timestamp, and full transcript. Conversation rows and transcript headers include professional initials avatars.
- **Review testimonial avatars:** Fixed broken testimonial image paths in `LandingPage.tsx` to use the bundled `/public/avatars/` assets (`sarah.svg`, `ali.svg`, `techcorp.svg`), so the small profile circles render correctly.
- **Scope:** No complaint-analysis/rule-matrix behavior was changed by this update; the change is isolated to chat identity/history, admin chat presentation, and testimonial avatar asset wiring.

## Verification — chat/avatar update
- Python compilation: passed.
- SRS contract/regression tests: **10/10 passed** (includes chat identity persistence and Admin transcript coverage).
- Offline SRS asset check: **136 rules / 265 escalation conditions / 500 benchmark cases / 100 unseen cases / 20 prompt-injection cases (20/20 detected)**.
- Broken testimonial avatar references: removed; all three bundled avatar assets exist under `public/avatars/`.
- Full Vite/TypeScript production build: not executed because project dependencies (`node_modules`) are not installed in the supplied environment. A parser-level TypeScript/TSX check reported no syntax diagnostics; dependency-resolution diagnostics remain expected without installed packages.
