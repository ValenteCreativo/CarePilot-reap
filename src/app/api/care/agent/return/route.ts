import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireIdentity } from '@/lib/care-agent/auth';
import { fail } from '@/lib/care-agent/http';
import { verifySigned } from '@/lib/care-agent/security';
import { runAction } from '@/lib/care-agent/orchestrator';
import { AgentError } from '@/lib/care-agent/types';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const identity = await requireIdentity();
    const encoded = new URL(request.url).searchParams.get('state');
    if (!encoded || encoded.length > 1000) throw new AgentError('RETURN_STATE_INVALID', 'Invalid return.');
    const payload = z.object({ state: z.object({ runId: z.uuid(), kind: z.enum(['enrollment', 'checkout']), expires: z.number().positive() }).strict(), signature: z.string() }).parse(JSON.parse(Buffer.from(encoded, 'base64url').toString()));
    if (!verifySigned(payload.state, payload.signature) || payload.state.expires <= Date.now()) throw new AgentError('RETURN_STATE_INVALID', 'Expired or invalid return.');
    await runAction(payload.state.runId, identity, { action: payload.state.kind === 'enrollment' ? 'sync-enrollment' : 'sync-checkout' });
    const origin = process.env.CAREPILOT_APP_ORIGIN;
    if (!origin) throw new AgentError('RETURN_URL_CONFIG', 'The application origin is missing.', 503);
    return NextResponse.redirect(new URL(`/care-agent?run=${payload.state.runId}`, origin));
  } catch (error) { return fail(error); }
}
