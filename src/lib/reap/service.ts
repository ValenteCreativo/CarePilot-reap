import { z } from 'zod';
import { reapRequest } from './client';
import { AgentError, categories, shippingSchema, type Candidate, type Checkout, type Enrollment, type Intent, type Quote, type Shipping } from '../care-agent/types';
const money = z.object({ amount: z.number().nonnegative(), currency: z.string().length(3) });
const action = z.object({ type: z.literal('REDIRECT'), url: z.url(), expiresAt: z.iso.datetime().optional() }).nullable();
export const enrollmentSchema = z.object({ id: z.string().min(1), status: z.string(), owner: z.object({ type: z.string(), id: z.string() }), nextAction: action }).passthrough();
export const quoteSchema = z.object({ id: z.string().min(1), expiresAt: z.iso.datetime(), amountBreakdown: z.object({ finalAmount: money }).passthrough(), shippingOptions: z.array(z.object({ id: z.string(), name: z.string(), selected: z.boolean(), price: money })).optional() }).passthrough();
export const checkoutSchema = z.object({ id: z.string().min(1), status: z.string(), quoteId: z.string(), enrollmentId: z.string(), orderId: z.string().nullable().optional(), finalAmount: money.optional(), nextAction: action }).passthrough();
const terms = { wipes: /toallita|wipes?/i, gloves: /guantes?|gloves?/i, soap: /jab[oó]n|soap/i };
export function matchesCategory(name: string, category: typeof categories[number]) {
  if (!terms[category].test(name) || /medicamento|antibi[oó]tico|prescripci[oó]n|prescription|surgical|quir[uú]rgic|floor|piso|shoe|calzado|sneaker|heavy-duty|wear-resistant|kitchen|cocina|pet care|mascota|surface|superficie|automotive/i.test(name)) return false;
  if (category === 'wipes') return /body|skin|baby|personal|higiene|corporal|piel|beb[eé]/i.test(name);
  if (category === 'soap') return /hand|body|skin|personal|higiene|mano|corporal|neutro/i.test(name);
  return /disposable|desechable|higiene|personal/i.test(name);
}
// <=3 searches + 1 details + 1 variant resolution; no catalog result supplied by Tavily.
export async function discover(intent: Intent): Promise<Candidate[]> {
  const found: { id: string; category: typeof categories[number] }[] = [];
  const queries = { wipes: 'personal body wet wipes', gloves: 'disposable hygiene gloves', soap: 'hand soap' };
  for (const category of intent.needs) {
    const search = await reapRequest('/agentic/products/search', z.object({ products: z.array(z.object({ id: z.string(), name: z.string(), available: z.boolean().optional() }).passthrough()) }), { query: queries[category], context: { country: 'MX', currency: 'MXN' }, filters: { availability: 'AVAILABLE_ONLY' }, pagination: { limit: 5 } });
    found.push(...search.products.filter(p => p.available !== false && matchesCategory(p.name, category)).slice(0, 1).map(p => ({ id: p.id, category })));
    if (found.length) break; // one vertical purchase, never a multi-product shopping loop
  }
  return resolveProducts(found);
}
export async function discoverQuery(query: string): Promise<Candidate[]> {
  const search = await reapRequest('/agentic/products/search', z.object({ products: z.array(z.object({ id: z.string(), name: z.string(), available: z.boolean().optional() }).passthrough()) }), { query, context: { country: 'MX', currency: 'MXN' }, filters: { availability: 'AVAILABLE_ONLY' }, pagination: { limit: 5 } });
  const found = search.products.filter(p => p.available !== false && !/prescription|antibiotic|medicamento|prescripci[oó]n/i.test(p.name)).slice(0, 3).map(p => ({ id: p.id, category: 'other' as const }));
  return resolveProducts(found);
}
async function resolveProducts(found: {id: string; category: Candidate['category']}[]): Promise<Candidate[]> {
  if (!found.length) return [];
  const variant = z.object({ id: z.string(), name: z.string().optional(), available: z.boolean().optional(), requiresShipping: z.boolean().optional(), price: money, options: z.array(z.object({ name: z.string(), value: z.string() })) }).passthrough();
  const details = await reapRequest('/agentic/products/details', z.object({ products: z.array(z.object({ id: z.string(), name: z.string(), merchant: z.object({ name: z.string() }).passthrough(), options: z.array(z.object({ name: z.string(), values: z.array(z.object({ optionId: z.string(), label: z.string(), available: z.boolean().optional() })) })), defaultVariant: variant }).passthrough()) }), { productIds: found.map(p => p.id) });
  const candidates: Candidate[] = [];
  for (const p of details.products.slice(0, 3)) {
    const category = found.find(item => item.id === p.id)?.category;
    if (!category || (category !== 'other' && !matchesCategory(p.name, category))) continue;
    let v = p.defaultVariant;
    if (p.options.length) {
      const optionIds = p.options.map(o => {
        const selected = v.options.find(s => s.name === o.name);
        return o.values.find(value => value.label === selected?.value && value.available !== false)?.optionId;
      });
      if (optionIds.some(id => !id)) continue;
      v = await reapRequest('/agentic/products/variant', variant, { productId: p.id, optionIds });
    }
    if (v.available !== true) continue;
    // Catalog currency/price is informational, not a final quote or FX rate.
    // If shipping metadata is omitted, collect an address conservatively.
    candidates.push({ productId: p.id, variantId: v.id, name: `${p.name} · ${v.name ?? 'Default variant'}`, merchant: p.merchant.name, category, requiresShipping: v.requiresShipping !== false, price: v.price });
  }
  return candidates;
}
export const reap = {
  discover,
  getEnrollment: (id: string): Promise<Enrollment> => reapRequest(`/agentic/enrollments/${encodeURIComponent(id)}`, enrollmentSchema),
  createEnrollment: (body: unknown, key: string): Promise<Enrollment> => reapRequest('/agentic/enrollments', enrollmentSchema, body, key),
  getQuote: (id: string): Promise<Quote> => reapRequest(`/agentic/quotes/${encodeURIComponent(id)}`, quoteSchema),
  createQuote: (body: unknown, key: string): Promise<Quote> => reapRequest('/agentic/quotes', quoteSchema, body, key),
  createCheckout: (body: unknown, key: string): Promise<Checkout> => reapRequest('/agentic/checkouts', checkoutSchema, body, key),
  getCheckout: (id: string): Promise<Checkout> => reapRequest(`/agentic/checkouts/${encodeURIComponent(id)}`, checkoutSchema),
};
export function itemQuote(variantId: string, email: string, requiresShipping: boolean, shipping?: Shipping) {
  if (requiresShipping && !shipping) throw new AgentError('SHIPPING_REQUIRED', 'Complete the shipping address.');
  return { items: [{ variantId, quantity: 1 }], email, ...(shipping ? { shippingAddress: shippingSchema.parse(shipping) } : {}) };
}
