import { z } from 'zod';
export const categories = ['wipes', 'gloves', 'soap'] as const;
export const intentSchema = z.object({
  needs: z.array(z.enum(categories)).min(1).max(3),
  responsible: z.string().trim().min(1).max(80),
  payer: z.literal('self'),
  budget: z.object({ amount: z.number().positive().max(100000), currency: z.enum(['MXN', 'SGD', 'USD']) }).strict(),
  tasks: z.array(z.string().trim().min(1).max(180)).min(1).max(5),
  clarification: z.string().max(300).nullable(),
}).strict();
export type Intent = z.infer<typeof intentSchema>;
export type Identity = { id: string; email: string; name: string };
export type ResearchSource = { title: string; url: string; excerpt: string; consultedAt: string; prices: { amount: string; currency: string | null; evidence: string }[] };
export type Candidate = { productId: string; variantId: string; name: string; merchant: string; category: typeof categories[number] | 'other'; requiresShipping: boolean; price: { amount: number; currency: string } };
export type Draft = { id: string; intent: Intent; origin: 'brian' | 'human'; researchedAt: string; sources: ResearchSource[]; candidates: Candidate[]; blockers: string[]; expiresAt: string };
export type Money = { amount: number; currency: string };
export type Shipping = { firstName: string; lastName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; region?: string; postalCode?: string; country: string };
export type Quote = { id: string; expiresAt: string; amountBreakdown: { finalAmount: Money; [key: string]: unknown }; shippingOptions?: { id: string; name: string; selected: boolean; price: Money }[]; [key: string]: unknown };
export type Enrollment = { id: string; status: string; owner: { type: string; id: string }; nextAction: { type: string; url: string; expiresAt?: string } | null; [key: string]: unknown };
export type Checkout = { id: string; status: string; quoteId: string; enrollmentId: string; orderId?: string | null; finalAmount?: Money; nextAction: { type: string; url: string; expiresAt?: string } | null; [key: string]: unknown };
export type Operation = { key: string; body: unknown; startedAt: string; state: 'pending' | 'done' | 'rejected'; code?: string; resourceId?: string };
export type Run = { id: string; ownerId: string; createdAt: string; agreement: Draft; selected?: Candidate; enrollment?: Enrollment; quote?: Quote; approval?: { hash: string; payerId: string; approvedAt: string; terms: unknown }; checkout?: Checkout; checkoutVerifiedAt?: string; operations: Partial<Record<'enrollment' | 'quote' | 'checkout', Operation>>; audit: { at: string; event: string }[] };
export class AgentError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export const shippingSchema = z.object({ firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100), phone: z.string().regex(/^\+[1-9]\d{6,14}$/), addressLine1: z.string().min(1).max(200), addressLine2: z.string().max(200).optional(), city: z.string().min(1).max(100), region: z.string().max(100).optional(), postalCode: z.string().max(30).optional(), country: z.string().regex(/^[A-Z]{2}$/) }).strict();
