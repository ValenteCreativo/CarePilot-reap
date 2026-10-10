# CarePilot

**Copilot for caregiving. Agentic payments by Reap.**

Caring for a loved one is a stream of small, recurring purchases — medicine that runs
out, hygiene supplies, test co-pays, groceries. Someone always has to do them by hand.
CarePilot turns those into an organized plan and lets an agent **buy them with Reap**,
within an approved budget and with human authorization.

- **Cuak** — our care assistant, an LLM agent powered by **Nebius Token Factory**
  (Qwen3). It understands a plain-language need, schedules appointments, splits
  responsibilities, researches products (via **Tavily** + the **Reap** catalog), and
  triggers the purchase.
- **Reap** — the agentic-payments infrastructure. Product discovery, real quotes, card
  enrollment, checkout, and verification all run against the **Reap Agentic module**
  (SG sandbox). No price is ever invented; no charge happens without authorization.

> Hackathon: Agentic Hackathon (Reap × AI Builders Mexico). Theme: *Vida diaria*
> (everyday spending for someone you care for). Everything runs in the Reap **sandbox** —
> no real money moves.

---

## The one-shot idea

```
A care need  ->  Cuak understands & organizes  ->  Reap pays  ->  care stays on track
```

The admin workspace (`/admin`) is a single screen built so this reads in ~3 seconds: a
hero lockup (**cuak × reap**), a live Reap sandbox status, and a kanban board where a
task flows left-to-right and the **"Pay with Reap"** column is literally the agentic
checkout.

---

## Architecture

Next.js 16 (App Router, React 19, TypeScript). Server routes only ever call Reap from
the server; card data never touches CarePilot or the LLM.

```
src/
  app/
    admin/                      # the care OS (/admin) — single-screen workspace
    care-agent/                 # full end-to-end Reap agentic checkout UI
    care-shop/                  # product research + Reap quote (no checkout)
    api/care/
      chat/                     # Cuak chat (Nebius) — schedule/split/research/shop
      ingest/                   # "Prepare my plan" (Nebius -> proposals)
      reap/status/              # live Reap sandbox connectivity probe
      agent/                    # the agentic payment state machine endpoint
      shop/                     # research + quote endpoint
  components/care/
    workspace.tsx               # the admin board, hero, metrics, Reap spotlight
    chat.tsx                    # Cuak assistant panel
    agent.tsx                   # the full Reap checkout flow UI
  lib/
    nebius.ts                   # Nebius Token Factory client (Qwen3)
    care/                       # chat, ingest, shopping, types (the care domain)
    care-agent/                 # orchestrator state machine, security, store, types
    reap/                       # Reap client + service (every Agentic endpoint)
```

### How the money path works (safely)

1. **Prepare** — Cuak (Nebius) interprets the need into a budgeted, human-reviewable
   intent; Tavily + Reap research produce real sources and catalog candidates.
2. **Confirm** — a signed Care Agreement is persisted (Postgres).
3. **Enroll** — card registration happens on Reap's hosted page (OTP never seen by us).
4. **Quote** — a real Reap quote with final amount and currency.
5. **Approve** — the funder authorizes; the quote terms are hashed and budget-checked.
6. **Checkout** — Reap executes the agentic checkout.
7. **Verify** — status is read back from Reap; "completed" requires an order id + final
   amount, and any amount discrepancy is flagged.

Guards worth knowing: HMAC-signed drafts/returns, idempotency keys persisted *before*
each Reap call (uncertain results stay pending, never duplicated), MXN-only budget math
with no FX, and strict path allow-listing on the Reap client.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000  (or 3001 if 3000 is taken)
```

Open **`/admin`** for the main experience.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEBIUS_MODEL` | Cuak's LLM (Nebius Token Factory, Qwen3) |
| `TAVILY_API_KEY` | Real product/price research |
| `REAP_API_TOKEN`, `REAP_BASE_URL`, `REAP_API_VERSION` | Reap Agentic module (SG sandbox) |
| `DATABASE_URL` | Neon Postgres — accounts + persisted agentic runs |
| `CAREPILOT_APP_ORIGIN` | Public HTTPS origin for Reap redirect return URLs |
| `CARE_AGENT_SESSION_SECRET` | HMAC secret (≥32 chars) for signed drafts/sessions |

The `/admin` board and Cuak work with just Nebius + Reap + Tavily. The full checkout at
`/care-agent` additionally needs `DATABASE_URL`, `CAREPILOT_APP_ORIGIN`, and
`CARE_AGENT_SESSION_SECRET`.

### Scripts

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # tsx --test tests/*.test.ts
```

---

## Notes

- **Sandbox only.** Reap checkout is simulated; no real money moves.
- **Human-in-the-loop.** No action authorizes a payment on its own; the funder approves
  real quote terms before any checkout.
- **No invented data.** Prices and merchants come from Reap/Tavily, never the model.

For a deeper, criteria-by-criteria walkthrough aimed at evaluators, see
[`JUDGES.md`](./JUDGES.md).
