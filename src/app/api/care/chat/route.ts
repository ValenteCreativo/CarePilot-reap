import { NextRequest, NextResponse } from 'next/server';
import { chatCare, chatRequestSchema } from '@/lib/care/chat';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if(request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:'Unauthorized origin.'},{status:403,headers});
  const raw = await request.text();
  if (raw.length > 60000) return NextResponse.json({ error: 'The conversation is too long.' }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid message.' }, { status: 400, headers }); }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'Check the message and try again.' }, { status: 400, headers });
  try { return NextResponse.json(await chatCare(parsed.data), { headers }); }
  catch { return NextResponse.json({ error: 'Cuak could not respond. Please try again in a moment.' }, { status: 502, headers }); }
}
