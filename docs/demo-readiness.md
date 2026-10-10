# CarePilot demo readiness

## Confirmed in the configured Reap SG sandbox

A fresh `hand soap` search on October 10, 2026 returned these catalog products from
**Spectrum Store** through the real Reap product search and details endpoints:

| Product | Catalog price |
|---------|---------------|
| Hand Soap — Ginger Lime | SGD 31.10 |
| Foaming Hand Soap — Cotton & Linen | SGD 25.10 |
| Hand Soap — Herbes de Provence | SGD 31.10 |

These are catalog results, not final quotes or completed orders. Shipping is required.
Availability and prices can change; the live API remains the authority. This does not
establish merchant availability for production or delivery to Mexico.

## Recommended judge access

Use a dedicated CarePilot test account, distributed privately to the evaluators.
Keep its care data synthetic and its payment enrollment exclusively in Reap sandbox.
Do not publish a real card, a personal login or an enrollment token in the frontend.
Use the test card procedure supplied by Reap on its hosted page. Keep explicit quote
review and hosted approval; sandbox does not make shared ownership or privacy checks
unnecessary.

Before offering a working checkout demo:

1. Configure the accounts database and apply the agent migration.
2. Configure a public HTTPS return origin and the signing secret.
3. Create the dedicated test account and verify access to the sandbox enrollment.
4. Resolve the currency mismatch: current agreements only allow MXN, while these
   products are priced in SGD. A demo budget must explicitly use the quote's native
   currency; do not invent an exchange rate or bypass the budget check.
5. Verify the complete path: agreement, enrollment, quote, approval, checkout,
   read-back `COMPLETED`, order ID and final amount. Record only sanitized evidence.

The local environment checked during this review had no configured database or
return origin. No checkout was executed. Deployment configuration must be checked
separately; local values do not prove what is configured on Vercel.

Reap documents a sandbox checkout simulation header. If used for evaluation, label
the result as a simulated sandbox order, never as a real purchase or delivery.

Primary references:
- [Reap setup](https://docs.reap.global/agentic-payments/setup)
- [One-time purchases](https://docs.reap.global/agentic-payments/one-time-purchases)
- [Merchant coverage FAQ](https://docs.reap.global/agentic-payments/faq)

## What would make this a stronger product

1. Shared, persistent care circles with invitations and clear permissions. The board
   is currently local to one browser; real collaboration is the core product promise.
2. A short onboarding: who needs care, who can help, and the first task or restock.
3. Useful reminders and restock proposals, with a clear owner and approval. Measure
   missed tasks and time saved rather than the number of AI messages.
4. Financial clarity: planned versus spent amounts, receipts, who paid, and the
   next expected expense. Avoid treating a completed task as a confirmed payment.
5. Validate the US$30/month family subscription with caregivers. Measure retention,
   AI/research cost per care circle and support load before promising unlimited usage.
