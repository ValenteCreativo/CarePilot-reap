import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AgentError } from './types';
import { neon } from '@neondatabase/serverless';
import { sign } from './security';
export function fail(error: unknown) {
  if (error instanceof AgentError) {
    const retry = (error as AgentError & { retryAfter?: string | null }).retryAfter;
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (retry && /^\d{1,5}$/.test(retry)) headers['Retry-After'] = retry;
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status, headers });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'INPUT_INVALID', message: 'The input does not match the required format.' }, { status: 400 });
  // Do not echo upstream messages, SQL, prompts or secrets.
  return NextResponse.json({ error: 'AGENT_INTERNAL_ERROR', message: 'The operation could not be completed. Check configuration and migrations.' }, { status: 503 });
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AgentError('JSON_REQUIRED', 'Se requiere JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AgentError('INPUT_REQUIRED', 'Se requiere entrada.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 80000) { await reader.cancel(); throw new AgentError('INPUT_TOO_LARGE', 'Entrada demasiado grande.', 413); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function limit(scope: string, key: string, maximum: number) {
  if (!process.env.DATABASE_URL) throw new AgentError('DATABASE_CONFIG_MISSING', 'DATABASE_URL and the agent migration are missing.', 503);
  const sql = neon(process.env.DATABASE_URL);
  const keyHash = sign({ scope, key });
  const rows = await sql`INSERT INTO care_agent_login_limits(key_hash,attempts,expires_at) VALUES (${keyHash},1,now()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN care_agent_login_limits.expires_at<=now() THEN 1 ELSE care_agent_login_limits.attempts+1 END, expires_at=CASE WHEN care_agent_login_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE care_agent_login_limits.expires_at END RETURNING attempts`;
  if (Number(rows[0].attempts) > maximum) throw new AgentError('RATE_LIMIT', 'Attempt limit reached. Wait 15 minutes.', 429);
}
