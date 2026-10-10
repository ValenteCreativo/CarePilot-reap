// Shared server adapter for all CarePilot Agentic Payments calls. Never import into client components.
import { z } from 'zod';
import { AgentError } from '../care-agent/types';
export class ReapError extends AgentError {
  constructor(code: string, public upstreamStatus: number, public uncertain: boolean, public retryAfter: string | null) { super(code, `Reap respondió ${code} (HTTP ${upstreamStatus}).`, upstreamStatus >= 500 ? 502 : upstreamStatus === 429 ? 429 : 409); }
}
export function reapConfig() {
  const base = process.env.REAP_BASE_URL;
  const token = process.env.REAP_API_TOKEN;
  const version = process.env.REAP_API_VERSION;
  if (base !== 'https://sg.sandbox.api.reap.global' || !token || version !== '2025-02-14') throw new AgentError('REAP_CONFIG_MISSING', 'Configura Reap SG sandbox y versión 2025-02-14.', 503);
  return { base, token, version };
}
export async function reapRequest<T>(path: string, schema: z.ZodType<T>, body?: unknown, key?: string): Promise<T> {
  const c = reapConfig();
  if (!/^\/agentic\//.test(path) || path.includes('://')) throw new AgentError('REAP_PATH_INVALID', 'Ruta Reap no permitida.');
  const headers: Record<string, string> = { Authorization: `Bearer ${c.token}`, 'Reap-Version': c.version };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  let response: Response;
  try { response = await fetch(c.base + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000), cache: 'no-store', redirect: 'error' }); }
  catch { throw new ReapError('REAP_TRANSPORT_UNCERTAIN', 504, body !== undefined, null); }
  if (!response.ok) {
    let code = 'REAP_UNKNOWN_ERROR';
    try { const data = await response.json(); if (/^[A-Z_]+$/.test(data?.error?.code)) code = data.error.code; } catch { /* no raw body disclosure */ }
    throw new ReapError(code, response.status, response.status >= 500, response.headers.get('Retry-After'));
  }
  let json: unknown;
  try { json = await response.json(); } catch { throw new ReapError('REAP_RESPONSE_UNCERTAIN', 502, body !== undefined, null); }
  const result = schema.safeParse(json);
  if (!result.success) throw new ReapError('REAP_SCHEMA_UNCERTAIN', 502, body !== undefined, null);
  return result.data;
}
