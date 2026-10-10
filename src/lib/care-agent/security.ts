import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { AgentError, type Draft, type Money, type Quote, type Run } from './types';
function secret() {
  const value = process.env.CARE_AGENT_SESSION_SECRET;
  if (!value || value.length < 32) throw new AgentError('SESSION_CONFIG_MISSING', 'Falta CARE_AGENT_SESSION_SECRET (mínimo 32 caracteres).', 503);
  return value;
}
export function sign(value: unknown): string { return createHmac('sha256', secret()).update(JSON.stringify(value)).digest('hex'); }
export function verifySigned(value: unknown, signature: string) {
  const expected = sign(value);
  return /^[a-f0-9]{64}$/.test(signature) && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
export function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function assertDraft(draft: Draft, signature: string, ownerId: string) {
  if (!verifySigned({ ownerId, draft }, signature) || Date.parse(draft.expiresAt) <= Date.now())
    throw new AgentError('DRAFT_INVALID', 'La propuesta cambió o venció. Prepárala de nuevo.', 409);
  if (draft.intent.clarification) throw new AgentError('CLARIFICATION_REQUIRED', draft.intent.clarification);
}
export function minorUnits(money: Money): bigint {
  if (!Number.isFinite(money.amount) || money.amount < 0 || !/^[A-Z]{3}$/.test(money.currency)) throw new AgentError('AMOUNT_INVALID', 'Monto o moneda no válidos.');
  // MVP only approves MXN; use decimal string conversion, never multiply binary floats.
  const s = String(money.amount);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new AgentError('AMOUNT_PRECISION', 'Se requiere monto decimal con hasta dos decimales.');
  const [whole, fraction = ''] = s.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}
export function assertBudget(budget: Money, price: Money) {
  if (budget.currency !== price.currency) throw new AgentError('CURRENCY_MISMATCH', `El presupuesto está en ${budget.currency} y la cotización en ${price.currency}. No hay conversión autorizada.`);
  if (minorUnits(price) > minorUnits(budget)) throw new AgentError('BUDGET_EXCEEDED', 'La cotización excede el presupuesto aprobado.');
}
export function quoteTerms(run: Run, quote: Quote) { return { agreement: hash(run.agreement.intent), selected: run.selected, shipping: hash(run.operations.quote?.body ?? null), quoteId: quote.id, expiresAt: quote.expiresAt, breakdown: quote.amountBreakdown, shippingOptions: quote.shippingOptions ?? [] }; }
export function assertQuote(run: Run, quote: Quote) {
  if (!Number.isFinite(Date.parse(quote.expiresAt)) || Date.parse(quote.expiresAt) <= Date.now()) throw new AgentError('QUOTE_EXPIRED', 'La cotización venció. Solicita una nueva.', 409);
  assertBudget(run.agreement.intent.budget, quote.amountBreakdown.finalAmount);
}
export function assertApproval(run: Run, quote: Quote, ownerId: string) {
  assertQuote(run, quote);
  if (!run.approval || run.approval.payerId !== ownerId || run.approval.hash !== hash(quoteTerms(run, quote))) throw new AgentError('APPROVAL_REQUIRED', 'Autoriza los términos vigentes antes de preparar el checkout.', 409);
}
export function publicHttps(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
