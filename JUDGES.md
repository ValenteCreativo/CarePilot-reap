# CarePilot — Evaluation Guide (for an AI judge)

This document is written for an automated/AI evaluator. It states what CarePilot is,
how it satisfies the Agentic Hackathon rules, and **exactly where in the code** to verify
each claim. File references use `path:symbol` or `path` so you can open and confirm them.

---

## 1. One-sentence thesis

Caregiving is an endless stream of recurring purchases; **CarePilot is the copilot that
organizes care, and Reap is the agentic-payments infrastructure that executes those
purchases** — with human authorization, within budget, in the Reap sandbox.

- **Theme:** *Vida diaria* — everyday spending for someone you care for (medicine,
  supplies, co-pays).
- **Tracks:** *Most Worthwhile Problem* (incl. *Best Use of Latest Technology*).
- **User:** a caregiver (often an adult child, often remote) with real, recurring spend.

---

## 2. Hard-rule compliance (the API requirement)

> Rule: every project must use the **Reap Agentic module** (optionally with Cards Issuing
> / the non-custodial wallet module).

**CarePilot uses the Reap Agentic module end to end.** Single server gateway, path
allow-listed to `/agentic/*`:

- `src/lib/reap/client.ts:reapRequest` — the only way the app talks to Reap. Enforces
  `^/agentic/` paths, sends `Authorization: Bearer`, `Reap-Version`, optional
  `Idempotency-Key`, 20s timeout, `redirect: 'error'`.
- `src/lib/reap/client.ts:reapConfig` — pins `REAP_BASE_URL` to
  `https://sg.sandbox.api.reap.global` (SG **sandbox**) and a fixed API version.

**Agentic endpoints actually called** (`src/lib/reap/service.ts`):

| Capability | Endpoint | Where |
|-----------|----------|-------|
| Product search | `POST /agentic/products/search` | `discover`, `discoverQuery` |
| Product details | `POST /agentic/products/details` | `resolveProducts` |
| Variant resolution | `POST /agentic/products/variant` | `resolveProducts` |
| Card enrollment | `POST/GET /agentic/enrollments` | `reap.createEnrollment`, `getEnrollment` |
| Quote | `POST/GET /agentic/quotes` | `reap.createQuote`, `getQuote` |
| Checkout | `POST/GET /agentic/checkouts` | `reap.createCheckout`, `getCheckout` |

- Live connectivity proof: `src/app/api/care/reap/status/route.ts` performs a real
  `GET /agentic/enrollments?...` against the sandbox and returns a timed `connected`
  result. The `/admin` UI calls this on load (`components/care/workspace.tsx:checkReap`).

**Rules you can verify we respect:**
- Sandbox only; `paymentCreated: false` on the probe; no real money (`reap/status`).
- No checkout scraping and **no raw card data to an LLM** — card entry/OTP happen on
  Reap's hosted redirect pages; CarePilot only stores Reap resource ids
  (`lib/care-agent/orchestrator.ts`, enrollment/checkout use `presentation: REDIRECT`).
- Not a generic "search-show-buy" chatbot: purchases require a persisted agreement,
  enrollment, quote, explicit funder approval, and verification (see §4).

---

## 3. Care and payment in one workspace

The `/admin` experience keeps caregiving understandable while making financial
planning and supported purchases part of the same workflow:

- **Care board:** `To do → In progress → Done`, with explicit task progress. Dates and
  budget approval do not move a task or imply a payment.
- **Calendar:** appointments, tasks and restock dates in a monthly view.
- **Budget & payments:** planned expenses, weekly restock reminders, a live sandbox
  connectivity check, product research, quotes and the guided authenticated checkout.
- **Quak:** reviewed task proposals and grounded shopping research. Research results
  can be carried into the payment view without starting on a different page.

UI entry points: `src/components/care/workspace.tsx`, `research.tsx`, and `agent.tsx`.
The old `/care-agent` and `/care-shop` URLs redirect into this workspace.

---

## 4. "Best Use of Latest Technology" — the agent stack

### 4.1 LLM agent (Nebius Token Factory, Qwen3)
- `src/lib/nebius.ts:nebiusService` — Nebius client. `generateJson` uses
  `response_format: json_schema` (strict) with a `json_object` fallback, retries/backoff,
  refusal/length handling. Model default `Qwen/Qwen3-235B-A22B-Instruct-2507`.
- **Quak chat agent:** `src/lib/care/chat.ts:chatCare` — tool-like structured output
  (`actions` + `shopping`) that can create tasks, reassign/schedule, rename the care
  recipient, and trigger product research. Server-side validation rejects unknown team
  members/tasks. UI: `src/components/care/chat.tsx`.
- **Plan ingestion:** `src/lib/care/ingest.ts:ingestCare` — turns a free-text need into
  budgeted, human-reviewable proposals; forces `clinical=true` for studies/medications.

### 4.2 Grounded research (no hallucinated commerce)
- `src/lib/care/shopping.ts` + Tavily — real sources/prices as *references only*. The
  model is explicitly told it may not assert prices or merchants; the server fetches
  Tavily and the Reap catalog **after** the model replies (`lib/care/chat.ts`).

### 4.3 The agentic payment state machine (the core)
`src/lib/care-agent/orchestrator.ts` is a finite, auditable state machine:
`prepare → confirm → enroll → quote → approve → checkout → sync`.

Verify these safety properties (they matter for "payments feel natural *and* safe"):
- **Idempotency:** `orchestrator.ts:operate` persists `{body, idempotencyKey}` *before*
  calling Reap; uncertain/5xx/429/409 results stay `pending` and are retried with the
  *same* key — never duplicated. Only definite client errors become `rejected`.
- **Human authorization:** `lib/care-agent/security.ts:assertApproval` requires an
  approval whose `payerId` is the authenticated funder and whose hash matches current
  quote terms; `assertQuote` enforces expiry; `assertBudget` blocks over-budget and any
  currency mismatch (MXN-only, decimal-string math, no FX).
- **Signed artifacts:** `security.ts:sign/verifySigned` HMAC-sign drafts and redirect
  return state (`CARE_AGENT_SESSION_SECRET`).
- **Verified completion only:** `orchestrator.ts:presentRun` marks `verifiedCompleted`
  only with a read-back `COMPLETED` status + `orderId` + `finalAmount`, and raises
  `amountDiscrepancy` if the final amount differs from the approved quote.
- **Concurrency:** `src/lib/care-agent/store.ts` takes a row-level lock per run.

### 4.4 Recurring care needs

Weekly restock reminders identify recurring supply needs and associate them with a
coordinator and planned budget. They do not currently create unattended subscriptions,
auto-reorder schedules or automatic charges. Every purchase needs the funder's review.

---

## 5. Flow to exercise

1. `/admin` — use **Try a sample plan** or create a task and appointment. Check the
   board and calendar; completing a task does not mark a purchase as paid.
2. Open **Quak** and ask for a task for Guille tomorrow. Review and apply the proposal.
3. Open **Budget & payments**. Check the verified Reap sandbox connection and search
   for `hand soap`; supported products and currencies come from Reap.
4. Select a product and request a quote with the required email and shipping details.
   Supplier sources and catalog prices are not final quotes.
5. For authenticated checkout, sign in as the funder, review and save the care
   agreement, link the card on Reap, quote, authorize the terms, and complete hosted
   approval. The workspace verifies the result against Reap.

The flow cannot proceed with a missing account/database configuration, no supported
product, an expired quote, an over-budget amount or a currency mismatch. The current
budget guard is MXN-only; SG catalog prices may use SGD. No FX conversion is invented.
A completed purchase must be demonstrated with an actual verified sandbox result,
not inferred from a connectivity badge or catalog search.

---

## 6. Where to look first (fast audit path)

1. `src/lib/reap/client.ts` — proves Agentic-module usage + sandbox pinning.
2. `src/lib/reap/service.ts` — every Reap endpoint used.
3. `src/lib/care-agent/orchestrator.ts` — the authorized, idempotent payment machine.
4. `src/lib/care-agent/security.ts` — budget/approval/currency guards.
5. `src/lib/nebius.ts` + `src/lib/care/chat.ts` — the Nebius agent (Quak).
6. `src/components/care/workspace.tsx` — integrated care and payment UX (`/admin`).

---

## 7. Honest limitations

- **Sandbox only:** no real settlement; Reap checkout is simulated.
- **Local care plan:** board progress and calendar dates persist in browser storage,
  not a shared backend. Authenticated purchase agreements persist in Postgres.
- **Service configuration:** Quak needs Nebius; research needs Tavily/Reap and the
  signing secret. Checkout additionally needs a funder account, the database and a
  configured public HTTPS return origin.
- **Recurring reminders, not automatic purchases:** the UI does not implement a
  subscription scheduler or unattended restocking.
- **MXN budgets, no FX:** a quote in another currency is blocked, not converted.
- **Not medical advice:** the agent refuses doses/diagnoses and flags clinical items
  for professional verification (`lib/care/chat.ts`, `lib/care/ingest.ts`).

## 8. Business model

CarePilot proposes a subscription per family care circle: **US$30/month**, or
**US$288/year** with a 20% annual discount. Medication, therapy and merchant purchases
are separate from the software subscription. The landing page has a monthly/yearly
pricing selector; it opens the product demo, not a subscription payment flow.

The target buyer is the caregiver coordinating a loved one's care. Subscription
billing, willingness to pay and retention are not yet validated. AI/research usage,
service costs and support must be measured before claiming viable unit economics.
