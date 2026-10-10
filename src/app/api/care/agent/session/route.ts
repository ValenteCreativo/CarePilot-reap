import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { assertSameOrigin, authenticate, issueSession, requireIdentity, sessionCookie } from '@/lib/care-agent/auth';
import { body, fail, limit } from '@/lib/care-agent/http';
export const runtime = 'nodejs';
export async function GET() {
  try { return NextResponse.json({ identity: await requireIdentity() }, { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email, password } = z.object({ email: z.email().max(254), password: z.string().min(1).max(256) }).strict().parse(await body(request));
    await limit('login', email.trim().toLowerCase(), 5);
    const identity = await authenticate(email, password);
    (await cookies()).set(sessionCookie, issueSession(identity), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 3600 });
    return NextResponse.json({ identity }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
export async function DELETE(request: Request) {
  try { assertSameOrigin(request); (await cookies()).delete(sessionCookie); return NextResponse.json({ ok: true }); } catch (error) { return fail(error); }
}
