import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { researchShopping } from '@/lib/care/shopping';
import { reap, itemQuote } from '@/lib/reap/service';
import { verifySigned } from '@/lib/care-agent/security';
import { AgentError, shippingSchema } from '@/lib/care-agent/types';
import { body, fail } from '@/lib/care-agent/http';
export const runtime = 'nodejs';
let lastResearch = 0;
let inFlight = false;
let quoteWindow = { starts: Date.now(), count: 0 };
const proofSchema = z.object({ candidates: z.array(z.object({ variantId:z.string(), requiresShipping:z.boolean() }).passthrough()), expires:z.number() });
export async function POST(request: Request) {
 try {
  if(request.headers.get('origin') !== new URL(request.url).origin) throw new AgentError('ORIGIN_INVALID','Origen no autorizado.',403);
  const input = await body(request);
  if(input.action === 'research') {
   if(inFlight || Date.now()-lastResearch<15000) throw new AgentError('RATE_LIMIT','Espera unos segundos antes de investigar otra vez.',429);
   inFlight=true; lastResearch=Date.now();
   try {
    return NextResponse.json(await researchShopping(input.query),{headers:{'Cache-Control':'no-store'}});
   } finally {inFlight=false;}
  }
  const command=z.object({action:z.literal('quote'),proof:proofSchema,signature:z.string(),variantId:z.string(),email:z.email(),shipping:shippingSchema.optional()}).parse(input);
  // Verify the exact original object including signed catalog fields.
  if(!verifySigned(input.proof,command.signature) || command.proof.expires<=Date.now()) throw new AgentError('PROPOSAL_EXPIRED','Investiga de nuevo: la propuesta venció o cambió.',409);
  const selected=command.proof.candidates.find(c=>c.variantId===command.variantId);
  if(!selected) throw new AgentError('PRODUCT_INVALID','Selecciona un producto confirmado por Reap.');
  if(Date.now()-quoteWindow.starts>900000) quoteWindow={starts:Date.now(),count:0};
  if(++quoteWindow.count>5) throw new AgentError('RATE_LIMIT','Límite de cinco cotizaciones por 15 minutos para esta demo.',429);
  const quote=await reap.createQuote(itemQuote(selected.variantId,command.email,selected.requiresShipping,command.shipping),randomUUID());
  return NextResponse.json({quote,withinBudget:quote.amountBreakdown.finalAmount.currency==='MXN' && quote.amountBreakdown.finalAmount.amount<=700},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return fail(error);}
}
