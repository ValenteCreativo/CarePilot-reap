import { test } from "node:test";
import assert from "node:assert/strict";
import { intentSchema, type Run } from "../src/lib/care-agent/types";
import { assertBudget } from "../src/lib/care-agent/security";
import { presentRun } from "../src/lib/care-agent/orchestrator";
import { circleStateSchema } from "../src/lib/care-circle/schema";
test("native SGD budget works; FX and over-budget amounts remain blocked", () => {
  const budget = { amount: 50, currency: "SGD" };
  assert.doesNotThrow(() =>
    assertBudget(budget, { amount: 31.1, currency: "SGD" }),
  );
  assert.throws(
    () => assertBudget(budget, { amount: 31.1, currency: "MXN" }),
    /no authorized conversion/,
  );
  assert.throws(
    () => assertBudget(budget, { amount: 50.01, currency: "SGD" }),
    /exceeds/,
  );
  assert.equal(
    intentSchema.safeParse({
      needs: ["soap"],
      responsible: "Guille",
      payer: "self",
      budget,
      tasks: ["Restock"],
      clarification: null,
    }).success,
    true,
  );
});
test("completed receipt needs readback, matching references and reconciled total", () => {
  const run = {
    id: "r",
    ownerId: "o",
    createdAt: "now",
    agreement: { intent: {}, candidates: [] },
    operations: {},
    audit: [],
    quote: {
      id: "q",
      expiresAt: "later",
      amountBreakdown: { finalAmount: { amount: 31.1, currency: "SGD" } },
    },
    enrollment: { id: "e" },
    checkout: {
      id: "c",
      status: "COMPLETED",
      orderId: "order",
      quoteId: "q",
      enrollmentId: "e",
      finalAmount: { amount: 31.1, currency: "SGD" },
    },
    checkoutVerifiedAt: "now",
  } as unknown as Run;
  assert.equal(presentRun(run).verifiedCompleted, true);
  assert.equal(
    presentRun({ ...run, checkoutVerifiedAt: undefined }).verifiedCompleted,
    false,
  );
  assert.equal(
    presentRun({
      ...run,
      checkout: {
        ...run.checkout!,
        finalAmount: { amount: 32, currency: "SGD" },
      },
    }).verifiedCompleted,
    false,
  );
  assert.equal(
    presentRun({
      ...run,
      checkout: { ...run.checkout!, enrollmentId: "other" },
    }).verifiedCompleted,
    false,
  );
});
test("shared snapshots reject unbounded or unsupported data", () => {
  assert.equal(
    circleStateSchema.safeParse({ person: "Mom", tasks: [], receipts: [] })
      .success,
    true,
  );
  assert.equal(
    circleStateSchema.safeParse({ person: "", tasks: [], receipts: [] })
      .success,
    false,
  );
  assert.equal(
    circleStateSchema.safeParse({
      person: "Mom",
      tasks: [],
      receipts: [{ id: "fake", amount: -1 }],
    }).success,
    false,
  );
});

test("authorized checkout is read back and repeated clicks cannot create a second order", async () => {
  const previousOrigin = process.env.CAREPILOT_APP_ORIGIN,
    previousSecret = process.env.CARE_AGENT_SESSION_SECRET;
  process.env.CAREPILOT_APP_ORIGIN = "https://demo.example.com";
  process.env.CARE_AGENT_SESSION_SECRET =
    "isolated-unit-test-secret-with-at-least-32-characters";
  try {
    const { runAction } = await import("../src/lib/care-agent/orchestrator");
    const { hash, quoteTerms } = await import("../src/lib/care-agent/security");
    const run = {
      id: "r",
      ownerId: "o",
      createdAt: "now",
      agreement: {
        intent: { budget: { amount: 50, currency: "SGD" } },
        candidates: [],
      },
      selected: { name: "Hand soap" },
      operations: {},
      audit: [],
      quote: {
        id: "q",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        amountBreakdown: { finalAmount: { amount: 36.1, currency: "SGD" } },
      },
      enrollment: {
        id: "e",
        status: "ACTIVE",
        owner: { type: "CLIENT_REFERENCE", id: "o" },
      },
    } as unknown as Run;
    run.approval = {
      hash: hash(quoteTerms(run, run.quote!)),
      payerId: "o",
      approvedAt: "now",
      terms: {},
    };
    let creates = 0;
    let persisted = false;
    const checkout = {
      id: "c",
      status: "COMPLETED",
      orderId: "test-order",
      quoteId: "q",
      enrollmentId: "e",
      finalAmount: { amount: 36.1, currency: "SGD" },
      nextAction: null,
    };
    const deps = {
      store: {
        withRun: async (
          _id: string,
          _owner: string,
          fn: (r: Run, save: () => Promise<void>) => Promise<Run>,
        ) =>
          fn(run, async () => {
            persisted = !!run.operations.checkout?.key;
          }),
      },
      payments: {
        getEnrollment: async () => run.enrollment,
        getQuote: async () => run.quote,
        createCheckout: async () => {
          assert.equal(persisted, true);
          creates++;
          return checkout;
        },
        getCheckout: async () => checkout,
      },
    } as unknown as import("../src/lib/care-agent/orchestrator").AgentDependencies;
    const who = { id: "o", email: "test@example.com", name: "Demo" };
    await runAction("r", who, { action: "checkout", confirmed: true }, deps);
    assert.equal(presentRun(run).verifiedCompleted, false);
    await runAction("r", who, { action: "checkout", confirmed: true }, deps);
    assert.equal(creates, 1);
    await runAction("r", who, { action: "sync-checkout" }, deps);
    assert.equal(presentRun(run).verifiedCompleted, true);
  } finally {
    if (previousOrigin === undefined) delete process.env.CAREPILOT_APP_ORIGIN;
    else process.env.CAREPILOT_APP_ORIGIN = previousOrigin;
    if (previousSecret === undefined)
      delete process.env.CARE_AGENT_SESSION_SECRET;
    else process.env.CARE_AGENT_SESSION_SECRET = previousSecret;
  }
});
