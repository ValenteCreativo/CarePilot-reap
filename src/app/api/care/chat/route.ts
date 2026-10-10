import { NextRequest, NextResponse } from 'next/server';
import { chatCare, chatRequestSchema } from '@/lib/care/chat';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if(request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:'Origen no autorizado.'},{status:403,headers});
  const raw = await request.text();
  if (raw.length > 60000) return NextResponse.json({ error: 'La conversación es demasiado larga.' }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Mensaje inválido.' }, { status: 400, headers }); }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'Revisa el mensaje e intenta de nuevo.' }, { status: 400, headers });
  try { return NextResponse.json(await chatCare(parsed.data), { headers }); }
  catch { return NextResponse.json({ error: 'Cuak no pudo responder. Intenta de nuevo en un momento.' }, { status: 502, headers }); }
}
