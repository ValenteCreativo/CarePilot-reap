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

## 3. "Agentic payments at the center" (not a side feature)

The product is organized so payments are the spine, not an add-on:

- `src/components/care/workspace.tsx` — the `/admin` board. Columns are
  `To do → In progress → Pay with Reap → Resolved` (`STAGES`). `stageOf()` routes a task
  into the **Reap column** once its budget is approved; that column is visually the
  agentic checkout. There is also a dedicated Reap spotlight panel ("Reap is the
  infrastructure that makes care pay for itself").
- The hero states the thesis in-screen; a live **Reap sandbox: Connected · N ms** chip is
  shown at the top.

---

## 4. "Best Use of Latest Technology" — the agent stack

### 4.1 LLM agent (Nebius Token Factory, Qwen3)
- `src/lib/nebius.ts:nebiusService` — Nebius client. `generateJson` uses
  `response_format: json_schema` (strict) with a `json_object` fallback, retries/backoff,
  refusal/length handling. Model default `Qwen/Qwen3-235B-A22B-Instruct-2507`.
- **Cuak chat agent:** `src/lib/care/chat.ts:chatCare` — tool-like structured output
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

### 4.4 Recurring, hands-free care spend (the track's example)
The explicit example — *"an agent that handles a recurring expense someone does by hand"*
— is the medicine/supplies reorder loop. `supplies`/`medication` task kinds, budgets, and
the Reap checkout column model this; the Reap spotlight panel frames it as recurring
automation.

---

## 5. End-to-end flow to exercise

1. `/admin` — observe the live Reap status chip (calls `reap/status`).
2. Open **Cuak** → ask for a need (e.g. "we're out of adult diapers, max $700, Guille
   handles it, I pay"). Cuak returns a proposal + **real** Tavily/Reap research.
3. Apply to plan → approve the budget → the card moves into the **Pay with Reap** column.
4. "Pay with Reap" / `/care-agent` — run the real flow: enroll → quote (real amount) →
   approve → checkout → verify (`COMPLETED` + `orderId`). All sandbox.

What you will **not** see (by design): invented prices, a charge without approval, or raw
card data in app logs/LLM input.

---

## 6. Where to look first (fast audit path)

1. `src/lib/reap/client.ts` — proves Agentic-module usage + sandbox pinning.
2. `src/lib/reap/service.ts` — every Reap endpoint used.
3. `src/lib/care-agent/orchestrator.ts` — the authorized, idempotent payment machine.
4. `src/lib/care-agent/security.ts` — budget/approval/currency guards.
5. `src/lib/nebius.ts` + `src/lib/care/chat.ts` — the Nebius agent (Cuak).
6. `src/components/care/workspace.tsx` — payments-at-the-center UX (`/admin`).

---

## 7. Honest limitations

- **Sandbox only** — no real settlement; Reap checkout is simulated per hackathon rules.
- **Admin board state is local/demo** (not persisted); the *agentic runs* at
  `/care-agent` **are** persisted in Postgres. The board and the persisted run model are
  intentionally separate surfaces.
- `/care-agent` and `/care-shop` require `DATABASE_URL`, `CAREPILOT_APP_ORIGIN`, and
  `CARE_AGENT_SESSION_SECRET`; `/admin` + Cuak need only Nebius/Reap/Tavily keys.
- Not medical advice: the agent refuses doses/diagnoses and flags clinical items for
  professional verification (`lib/care/chat.ts`, `lib/care/ingest.ts`).
