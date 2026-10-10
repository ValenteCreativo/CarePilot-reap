import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AgentError, intentSchema, type Draft, type Identity, type Run, type Shipping } from './types';
import { interpret } from './llm';
import { researchQuery, searchTavily } from './tavily';
import { reap, itemQuote } from '../reap/service';
import { ReapError } from '../reap/client';
import { store, type AgentStore } from './store';
import { assertApproval, assertBudget, assertDraft, assertQuote, hash, publicHttps, quoteTerms, sign } from './security';
export type AgentDependencies = { llm: typeof interpret; research: typeof searchTavily; payments: typeof reap; store: AgentStore };
const deps: AgentDependencies = { llm: interpret, research: searchTavily, payments: reap, store };
const now = () => new Date().toISOString();
function event(run: Run, name: string) { run.audit.push({ at: now(), event: name }); }
function returnUrl(runId: string, kind: 'enrollment' | 'checkout') {
  const origin = process.env.CAREPILOT_APP_ORIGIN;
  if (!origin || !publicHttps(origin) || new URL(origin).origin !== origin) throw new AgentError('RETURN_URL_CONFIG', 'Configure CAREPILOT_APP_ORIGIN with a public HTTPS origin.', 503);
  const state = { runId, kind, expires: Date.now() + 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify({ state, signature: sign(state) })).toString('base64url');
  return `${origin}/api/care/agent/return?state=${encodeURIComponent(encoded)}`;
}
function enrollmentOwner(run: Run, ownerId: string) {
  if (!run.enrollment || run.enrollment.owner.type !== 'CLIENT_REFERENCE' || run.enrollment.owner.id !== ownerId) throw new AgentError('ENROLLMENT_OWNER_MISMATCH', 'The enrollment does not match the authenticated funder.', 403);
}
// Finite server-side tool graph: <=1 LLM, <=1 Tavily, <=5 catalog calls; no autonomous payment tool.
export async function prepareAgent(text: string, identity: Identity, manual?: unknown, d = deps) {
  const intent = manual === undefined ? await d.llm(text) : intentSchema.parse(manual);
  if (intent.clarification) throw new AgentError('CLARIFICATION_REQUIRED', intent.clarification);
  assertBudget(intent.budget, intent.budget);
  const blockers: string[] = [];
  let sources: Draft['sources'] = []; let candidates: Draft['candidates'] = [];
  try { sources = await d.research(researchQuery(intent)); if (!sources.length) blockers.push('TAVILY_NO_RESULTS'); }
  catch (error) { if (!(error instanceof AgentError)) throw error; blockers.push(error.code); }
  try { candidates = await d.payments.discover(intent); if (!candidates.length) blockers.push('REAP_NO_COMPATIBLE_MATCH'); }
  catch (error) { if (!(error instanceof AgentError)) throw error; blockers.push(error.code); }
  const draft: Draft = { id: randomUUID(), intent, origin: manual === undefined ? 'brian' : 'human', researchedAt: now(), sources, candidates, blockers, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
  return { draft, signature: sign({ ownerId: identity.id, draft }) };
}
export async function confirmAgreement(draft: Draft, signature: string, identity: Identity, d = deps) {
  assertDraft(draft, signature, identity.id);
  const run: Run = { id: draft.id, ownerId: identity.id, agreement: draft, createdAt: now(), operations: {}, audit: [{ at: now(), event: 'AGREEMENT_CONFIRMED_BY_PAYER' }] };
  await d.store.create(run);
  return d.store.read(run.id, identity.id);
}
async function operate<T extends { id: string }>(run: Run, type: 'enrollment' | 'quote' | 'checkout', body: unknown, save: () => Promise<void>, call: (body: unknown, key: string) => Promise<T>) {
  let op = run.operations[type];
  if (op?.state === 'pending') {
    if (hash(op.body) !== hash(body)) throw new AgentError('OPERATION_UNCERTAIN', 'There is a pending operation with different terms. Reconcile it before changing it.', 409);
    if (Date.now() - Date.parse(op.startedAt) >= 23 * 60 * 60 * 1000) throw new AgentError('IDEMPOTENCY_WINDOW_REVIEW', 'The uncertain operation requires review with Reap before another attempt.', 409);
  } else {
    op = { key: randomUUID(), body, startedAt: now(), state: 'pending' };
    run.operations[type] = op;
  }
  event(run, `${type.toUpperCase()}_REQUEST_PERSISTED`);
  await save(); // Crash/timeout retains key and exact body.
  try {
    const result = await call(op.body, op.key);
    op.state = 'done'; op.resourceId = result.id;
    return result;
  } catch (error) {
    if (error instanceof ReapError) { op.code = error.code; if (!error.uncertain && ![401, 429, 409].includes(error.upstreamStatus)) op.state = 'rejected'; }
    // Unknown exceptions are uncertain: keep pending; never invent failure.
    event(run, `${type.toUpperCase()}_NOT_CONFIRMED`); await save(); throw error;
  }
}
export async function runAction(id: string, identity: Identity, command: { action: string; variantId?: string; shipping?: Shipping; termsHash?: string; confirmed?: boolean }, d = deps) {
  return d.store.withRun(id, identity.id, async (run, save) => {
    switch (command.action) {
      case 'enroll': {
        if (run.enrollment && !['FAILED', 'EXPIRED', 'REVOKED'].includes(run.enrollment.status)) break;
        const pending = run.operations.enrollment;
        const body = pending?.state === 'pending' ? pending.body : { source: 'EXTERNAL', owner: { type: 'CLIENT_REFERENCE', id: identity.id, email: identity.email }, presentation: { type: 'REDIRECT', returnUrl: returnUrl(run.id, 'enrollment') } };
        run.enrollment = await operate(run, 'enrollment', body, save, d.payments.createEnrollment);
        enrollmentOwner(run, identity.id);
        break;
      }
      case 'sync-enrollment': {
        if (!run.enrollment) throw new AgentError('ENROLLMENT_REQUIRED', 'Register the card first.');
        run.enrollment = await d.payments.getEnrollment(run.enrollment.id); enrollmentOwner(run, identity.id); break;
      }
      case 'quote': {
        if (run.checkout && !['FAILED', 'EXPIRED'].includes(run.checkout.status)) throw new AgentError('CHECKOUT_ALREADY_EXISTS', 'Check the existing checkout before preparing another purchase.', 409);
        if (run.operations.checkout?.state === 'pending') throw new AgentError('CHECKOUT_UNCERTAIN', 'Retry or reconcile the uncertain checkout before requoting.', 409);
        const selected = run.agreement.candidates.find(c => c.variantId === command.variantId);
        if (!selected) throw new AgentError('VARIANT_INVALID', 'Select a compatible variant retrieved from Reap.');
        // A valid existing quote is reused on repeated clicks.
        if (run.selected?.variantId === selected.variantId && run.quote && Date.parse(run.quote.expiresAt) > Date.now() && run.operations.quote?.state === 'done' && hash(run.operations.quote.body) === hash(itemQuote(selected.variantId, identity.email, selected.requiresShipping, command.shipping))) break;
        run.selected = selected; run.approval = undefined;
        const body = itemQuote(selected.variantId, identity.email, selected.requiresShipping, command.shipping);
        run.quote = await operate(run, 'quote', body, save, d.payments.createQuote);
        run.checkout = undefined; run.checkoutVerifiedAt = undefined;
        event(run, 'QUOTE_RECEIVED_NOT_AUTHORIZED');
        break;
      }
      case 'approve': {
        if (command.confirmed !== true || !run.quote || !run.selected) throw new AgentError('APPROVAL_REQUIRED', 'Review and confirm the quote terms.');
        const quote = await d.payments.getQuote(run.quote.id);
        assertQuote(run, quote);
        const terms = quoteTerms(run, quote); const currentHash = hash(terms);
        run.quote = quote;
        if (currentHash !== command.termsHash) { run.approval = undefined; await save(); throw new AgentError('TERMS_CHANGED', 'The terms changed. Review them and authorize again.', 409); }
        run.approval = { hash: currentHash, payerId: identity.id, approvedAt: now(), terms };
        event(run, 'PAYMENT_AUTHORIZED_BY_PAYER'); break;
      }
      case 'checkout': {
        if (command.confirmed !== true) throw new AgentError('APPROVAL_REQUIRED', 'Confirm that you want to open the Reap approval.');
        if (run.checkout) break; // Same checkout, including terminal: never recreate blindly.
        const uncertain = run.operations.checkout;
        if (uncertain?.state === 'pending') {
          if (!run.approval || run.approval.payerId !== identity.id) throw new AgentError('APPROVAL_REQUIRED', 'Authorization for the pending operation is missing.', 409);
          run.checkout = await operate(run, 'checkout', uncertain.body, save, d.payments.createCheckout);
          break;
        }
        if (!run.enrollment || !run.quote || !run.selected) throw new AgentError('CHECKOUT_PREREQUISITES', 'Enrollment, product or quote are missing.');
        run.enrollment = await d.payments.getEnrollment(run.enrollment.id); enrollmentOwner(run, identity.id);
        if (run.enrollment.status !== 'ACTIVE') throw new AgentError('ENROLLMENT_NOT_ACTIVE', 'Complete the card registration and verify it is ACTIVE.');
        run.quote = await d.payments.getQuote(run.quote.id);
        assertApproval(run, run.quote, identity.id);
        const op = run.operations.checkout;
        const body = op?.state === 'pending' ? op.body : { quoteId: run.quote.id, enrollmentId: run.enrollment.id, presentation: { type: 'REDIRECT', returnUrl: returnUrl(run.id, 'checkout') } };
        run.checkout = await operate(run, 'checkout', body, save, d.payments.createCheckout);
        event(run, 'CHECKOUT_CREATED_AWAIT_REAL_STATE'); break;
      }
      case 'sync-checkout': {
        if (!run.checkout) throw new AgentError('CHECKOUT_REQUIRED', 'There is no verifiable checkout yet.');
        const result = await d.payments.getCheckout(run.checkout.id);
        if (result.quoteId !== run.quote?.id || result.enrollmentId !== run.enrollment?.id) throw new AgentError('CHECKOUT_REFERENCE_MISMATCH', 'The checkout does not match the operation.', 502);
        const changed = run.checkout.status !== result.status || !run.checkoutVerifiedAt;
        run.checkout = result; run.checkoutVerifiedAt = now();
        if (changed) event(run, `CHECKOUT_READ_${/^[A-Z_]+$/.test(result.status) ? result.status : 'UNKNOWN'}`); break;
      }
      default: throw new AgentError('ACTION_INVALID', 'Agent action not allowed.');
    }
    await save();
    return run;
  });
}
export function presentRun(run: Run) {
  const completed = !!run.checkoutVerifiedAt && run.checkout?.status === 'COMPLETED' && !!run.checkout.orderId && !!run.checkout.finalAmount;
  const mismatch = completed && run.checkout?.finalAmount && run.quote ? hash(run.checkout.finalAmount) !== hash(run.quote.amountBreakdown.finalAmount) : false;
  return { ...run, operations: Object.fromEntries(Object.entries(run.operations).map(([key, op]) => [key, op && { state: op.state, code: op.code, startedAt: op.startedAt }])), termsHash: run.quote ? hash(quoteTerms(run, run.quote)) : null, verifiedCompleted: !!completed, amountDiscrepancy: !!mismatch };
}
export const agentCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare'), text: z.string().trim().min(3).max(4000) }).strict(),
  z.object({ action: z.literal('prepare-human'), intent: intentSchema, confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal('confirm'), draft: z.unknown(), signature: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.enum(['enroll', 'sync-enrollment', 'checkout', 'sync-checkout', 'read']), runId: z.uuid(), confirmed: z.boolean().optional() }).strict(),
  z.object({ action: z.literal('quote'), runId: z.uuid(), variantId: z.string().min(1).max(300), shipping: z.unknown().optional() }).strict(),
  z.object({ action: z.literal('approve'), runId: z.uuid(), termsHash: z.string(), confirmed: z.literal(true) }).strict(),
]);
