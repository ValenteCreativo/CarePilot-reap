# CarePilot recording guide

Live demo: https://carepilot-2.vercel.app/admin?view=payments

## Record the purchase first

Use **Chrome or Safari with passkeys enabled**. Reap's hosted enrollment requires device verification; the Codex in-app browser showed `Passkey Not Supported`. Do not reload a used hosted session link. Keep the same browser for CarePilot, enrollment and checkout so the signed funder session survives the return.

1. Select **Start checkout demo** for an isolated, synthetic judge session (one hour).
2. Select **Use hand soap demo · SGD50 limit**. This is an explicit sample selection, not an invented AI purchase.
3. Review the responsibilities and budget; select **Save & continue**. Saving the plan authorizes no charge.
4. Request the Reap quote. The sample includes a synthetic Singapore shipping address; no delivery is made. The live smoke test returned **SGD36.10**, including SGD5 shipping, below the SGD50 ceiling. Prices can change; review the current quote and expiry.
5. Link the card on Reap and complete its device/passkey verification yourself. The hosted step returns to CarePilot, which reads enrollment status from Reap. An `ACTIVE` enrollment can be reused only by its authenticated owner.
6. Review the final quote, explicitly authorize the product, merchant, shipping, currency and total, then continue to Reap approval. Complete any hosted verification.
7. CarePilot reads the checkout back from Reap. Success requires `COMPLETED`, an order reference, matching quote/enrollment references and a reconciled final amount. The receipt appears in Budget & payments with a downloadable record.

Official public sandbox test card, entered **only on Reap's hosted page**:

| Number | CVC | Expiry | OTP |
| --- | --- | --- | --- |
| 4622 9431 2313 7797 | 640 | 12/27 | 456789 |

This deployment enables Reap's documented `X-Simulate-Checkout: COMPLETED` header. It still uses real Reap API requests and hosted enrollment/approval, but the merchant order is **simulated**. No real money or delivery. The UI labels it accordingly and excludes it from real spending.

A connectivity badge, catalog item, quote or hosted return is not a completed order. On October 10 the catalog, persisted agreement and live quote were verified; full hosted approval was handed to the user because the in-app browser cannot create the required passkey. Do not claim end-to-end completion until readback provides the matching order and amount.

## Show the care product

- **One-minute setup:** person cared for, caregiver name and first need. The plan is stored in Postgres.
- **Invite a caregiver:** the coordinator creates a private, single-use link valid for seven days. Share it privately; use a separate browser profile/device to join as another caregiver. Up to three caregivers can manage the plan.
- **Synchronization:** updates poll every three seconds. Revision conflicts keep local edits and ask the caregiver to review the shared version. Server checks reject non-members.
- **Calendar and reminders:** due/overdue tasks show their owner. Completing a recurring task schedules the next weekly reminder. No unattended purchase or automatic charge occurs.
- **Budget and receipts:** manually record a therapy/nutrition/medication expense with amount, native currency, date and receipt reference. Compare MXN planned vs recorded spending; other currencies stay separate. Manual records are not provider-verified payments.
- **Reap evidence:** verified sandbox orders are scoped to the funder, carry the provider reference and remain separate from recorded real spending. Other caregivers cannot authorize purchases under the funder's identity.

## Configuration and evidence

Apply `database/initial.sql`. Configure `DATABASE_URL`, `CARE_AGENT_SESSION_SECRET`, `CAREPILOT_APP_ORIGIN` (public HTTPS), Reap sandbox credentials/version, Tavily and Nebius. Judge entry is explicitly gated by `CAREPILOT_DEMO_ENABLED=true`; merchant simulation by `REAP_SIMULATE_CHECKOUT=true`. The adapter is pinned to the SG sandbox and cannot address the production payment API.

Verified: production deployment, three distinct caregiver sessions, invitation joining, cross-session update visibility, stale-write rejection, non-member rejection, live catalog and quote, build/type checking, 14 unit tests. Demo accounts are synthetic and session-based; durable account recovery, notifications while the app is closed, receipt-file uploads and unattended purchases are future work.

Primary references:

- [Reap setup and official test cards](https://docs.reap.global/agentic-payments/setup)
- [One-time purchases and sandbox simulation](https://docs.reap.global/agentic-payments/one-time-purchases)
- [Merchant coverage FAQ](https://docs.reap.global/agentic-payments/faq)
