import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ingestCare } from '@/lib/care/ingest';
const schema = z.object({ source: z.enum(['web', 'omi', 'whatsapp']), familyId: z.literal('demo-family'), actorId: z.enum(['vale', 'guille']).optional(), text: z.string().trim().min(3).max(4000), externalEventId: z.string().max(150).optional(), receivedAt: z.iso.datetime() });
export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 16000) return NextResponse.json({ error: 'Message too long.' }, { status: 413 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Check the message and the input fields.' }, { status: 400 });
    if (parsed.data.source !== 'web') return NextResponse.json({ error: 'This channel is not enabled yet.' }, { status: 501 });
    return NextResponse.json(await ingestCare(parsed.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'The message could not be read.' }, { status: 400 });
    return NextResponse.json({ error: 'Proposals could not be generated with Nebius. Please try again.' }, { status: 502 });
  }
}
