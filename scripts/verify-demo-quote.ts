// Backend smoke test for a run created by the judge UI. No payment is executed.
import { neon } from "@neondatabase/serverless";
import { runAction } from "../src/lib/care-agent/orchestrator";
import type { Run } from "../src/lib/care-agent/types";
async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Provide the test agreement ID.");
  const sql = neon(process.env.DATABASE_URL!);
  const rows =
    await sql`SELECT r.state,u.email,u.name FROM care_agent_runs r JOIN users u ON u.id=r.owner_id WHERE r.id=${id}::uuid`;
  const run = rows[0]?.state as Run;
  if (!run || !String(rows[0].email).endsWith("@example.com"))
    throw new Error("Only a synthetic judge account is allowed.");
  const candidate = run.agreement.candidates[0];
  if (!candidate) throw new Error("No catalog candidate.");
  const updated = await runAction(
    id,
    {
      id: run.ownerId,
      email: String(rows[0].email),
      name: String(rows[0].name),
    },
    {
      action: "quote",
      variantId: candidate.variantId,
      shipping: {
        firstName: "Demo",
        lastName: "Caregiver",
        phone: "+6581234567",
        addressLine1: "1 Example Street",
        city: "Singapore",
        region: "Singapore",
        postalCode: "018989",
        country: "SG",
      },
    },
  );
  console.log(
    JSON.stringify({
      quoteId: updated.quote?.id,
      finalAmount: updated.quote?.amountBreakdown.finalAmount,
      expiresAt: updated.quote?.expiresAt,
      checkoutCreated: !!updated.checkout,
    }),
  );
}
main().catch((e) => {
  console.error(
    e.code || "QUOTE_CHECK_FAILED",
    e instanceof Error ? e.message : "Failed",
  );
  process.exitCode = 1;
});
