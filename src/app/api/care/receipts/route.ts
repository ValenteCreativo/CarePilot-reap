import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireIdentity } from "@/lib/care-agent/auth";
import { fail } from "@/lib/care-agent/http";
import { presentRun } from "@/lib/care-agent/orchestrator";
import type { Run } from "@/lib/care-agent/types";
export async function GET() {
  try {
    const identity = await requireIdentity();
    const sql = neon(process.env.DATABASE_URL!);
    const rows =
      await sql`SELECT state FROM care_agent_runs WHERE owner_id=${identity.id}::uuid ORDER BY created_at DESC LIMIT 100`;
    const receipts = rows
      .map((r) => presentRun(r.state as Run))
      .filter((r) => r.verifiedCompleted)
      .map((r) => ({
        id: r.checkout!.id,
        title: r.selected?.name || "Care purchase",
        merchant: r.selected?.merchant,
        amount: r.checkout!.finalAmount!.amount,
        currency: r.checkout!.finalAmount!.currency,
        date: r.checkoutVerifiedAt,
        reference: r.checkout!.orderId,
        source: "reap",
        sandbox: true,
        simulation: r.sandboxSimulation,
        runId: r.id,
      }));
    return NextResponse.json(
      { receipts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
