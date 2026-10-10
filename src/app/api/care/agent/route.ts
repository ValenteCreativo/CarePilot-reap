import { NextResponse } from 'next/server';
import { assertSameOrigin, requireIdentity } from '@/lib/care-agent/auth';
import { body, fail, limit } from '@/lib/care-agent/http';
import { agentCommandSchema, confirmAgreement, prepareAgent, presentRun, runAction } from '@/lib/care-agent/orchestrator';
import { shippingSchema, type Draft } from '@/lib/care-agent/types';
import { store } from '@/lib/care-agent/store';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireIdentity();
    const input = agentCommandSchema.parse(await body(request));
    await limit('operation', identity.id, 120);
    let result: unknown;
    if (input.action === 'prepare' || input.action === 'prepare-human') {
      await limit('prepare', identity.id, 6);
      result = input.action === 'prepare' ? await prepareAgent(input.text, identity) : await prepareAgent('', identity, input.intent);
    } else if (input.action === 'confirm') {
      result = { run: presentRun(await confirmAgreement(input.draft as Draft, input.signature, identity)) };
    } else if (input.action === 'read') {
      result = { run: presentRun(await store.read(input.runId, identity.id)) };
    } else {
      result = { run: presentRun(await runAction(input.runId, identity, { action: input.action, ...('variantId' in input ? { variantId: input.variantId } : {}), ...('termsHash' in input ? { termsHash: input.termsHash } : {}), ...('confirmed' in input ? { confirmed: input.confirmed } : {}), ...('shipping' in input && input.shipping !== undefined ? { shipping: shippingSchema.parse(input.shipping) } : {}) })) };
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
