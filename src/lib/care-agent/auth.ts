import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/password';
import { AgentError, type Identity } from './types';
import { sign, verifySigned } from './security';
export const sessionCookie = 'cp_agent_session';
export async function authenticate(email: string, password: string): Promise<Identity> {
  if (!process.env.DATABASE_URL) throw new AgentError('DATABASE_CONFIG_MISSING', 'The accounts database is missing.', 503);
  const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  let valid = false;
  try { valid = !!user?.passwordHash && verifyPassword(password, user.passwordHash); } catch { /* reject corrupted hash */ }
  if (!valid || !user?.email) throw new AgentError('IDENTITY_INVALID', 'Incorrect email or password.', 401);
  return { id: user.id, email: user.email, name: user.name || 'Funder' };
}
export function issueSession(identity: Identity) {
  const value = { id: identity.id, expires: Date.now() + 60 * 60 * 1000, nonce: randomUUID() };
  return Buffer.from(JSON.stringify({ value, signature: sign(value) })).toString('base64url');
}
export async function requireIdentity(): Promise<Identity> {
  const encoded = (await cookies()).get(sessionCookie)?.value;
  if (!encoded) throw new AgentError('LOGIN_REQUIRED', 'Sign in as the funder to continue.', 401);
  let value: { id: string; expires: number; nonce: string }; let signature: string;
  try { const token = JSON.parse(Buffer.from(encoded, 'base64url').toString()); value = token.value; signature = token.signature;
    if (!value || !verifySigned(value, signature) || !Number.isFinite(value.expires) || value.expires <= Date.now() || !/^[a-f0-9-]{36}$/i.test(value.id)) throw new Error();
  } catch { throw new AgentError('SESSION_INVALID', 'The funder session expired or is invalid.', 401); }
  if (!process.env.DATABASE_URL) throw new AgentError('DATABASE_CONFIG_MISSING', 'The accounts database is missing.', 503);
  const user = await db.query.users.findFirst({ where: eq(users.id, value.id) });
  if (!user?.email || !user.passwordHash) throw new AgentError('SESSION_INVALID', 'The account is not available.', 401);
  return { id: user.id, email: user.email, name: user.name || 'Funder' };
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const configured = process.env.CAREPILOT_APP_ORIGIN;
  const expected = process.env.NODE_ENV === 'production' ? configured : new URL(request.url).origin;
  if (!expected || origin !== expected) throw new AgentError('ORIGIN_INVALID', 'Unauthorized request origin.', 403);
}
