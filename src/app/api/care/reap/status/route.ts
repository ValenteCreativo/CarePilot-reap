import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reapConfig, reapRequest } from '@/lib/reap/client';
import { AgentError } from '@/lib/care-agent/types';

export const dynamic = 'force-dynamic';
type Proof = { configured: boolean; connected: boolean; environment: 'sandbox'; paymentCreated: false; message: string; verifiedAt?: string; elapsedMs?: number; code?: string };
let cached: { until: number; proof: Proof } | undefined;
let pending: Promise<Proof> | undefined;
async function check(): Promise<Proof> {
  const started = Date.now();
  let configured = false;
  try {
    reapConfig();
    configured = true;
    // Synthetic owner only; never return account data to the public diagnostic UI.
    await reapRequest('/agentic/enrollments?ownerType=CLIENT_REFERENCE&ownerId=carepilot-connectivity-probe&limit=1', z.object({ items: z.array(z.unknown()) }));
    return { configured, connected: true, environment: 'sandbox', paymentCreated: false, verifiedAt: new Date().toISOString(), elapsedMs: Date.now() - started, message: 'CarePilot received a valid response from the Reap sandbox using its server credentials.' };
  } catch (error) {
    return { configured, connected: false, environment: 'sandbox', paymentCreated: false, code: error instanceof AgentError ? error.code : 'REAP_CHECK_FAILED', message: configured ? 'Reap did not confirm the connection. Check the credentials or try again.' : 'Reap sandbox is not configured in the server variables.' };
  }
}
export async function GET() {
  // Bound repeated public diagnostics; preserve the actual verification timestamp.
  if (!cached || cached.until <= Date.now()) {
    pending ??= check().then(proof => { cached = { proof, until: Date.now() + 15_000 }; return proof; }).finally(() => { pending = undefined; });
    await pending;
  }
  return NextResponse.json(cached!.proof, { headers: { 'Cache-Control': 'no-store' } });
}
