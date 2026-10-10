import { z } from 'zod';
import { searchTavily } from '../care-agent/tavily';
import { discoverQuery } from '../reap/service';
import { sign } from '../care-agent/security';
import { AgentError } from '../care-agent/types';
export const shoppingQuerySchema = z.string().trim().min(2).max(160);
export function validateShoppingQuery(value: unknown) {
 const query=shoppingQuerySchema.parse(value);
 // Only generic product terms reach search providers; reject contact/clinical detail.
 if(/@|https?:|\b\d[\d\s()+-]{6,}\d\b|diagn[oó]stic|expediente|paciente|mi (mam[aá]|pap[aá]|madre|padre)|(?:se llama|vive en)|(?:padece|sufre de)|contrase[nñ]a|api.?key/i.test(query))
  throw new AgentError('SEARCH_PRIVACY','Enter only the product, brand or features; omit names, contact details and medical information.');
 return query;
}
const cache = new Map<string,{until:number;result:ShoppingResearch}>();
let pending = 0;
let searchWindow={starts:Date.now(),count:0};
export type ShoppingResearch = {
 query: string; sources: Awaited<ReturnType<typeof searchTavily>>; candidates: Awaited<ReturnType<typeof discoverQuery>>;
 errors: string[]; proof: { candidates: Awaited<ReturnType<typeof discoverQuery>>; expires:number }; signature:string; checkoutReady:boolean;
};
export async function researchShopping(value:unknown):Promise<ShoppingResearch>{
 const query=validateShoppingQuery(value);
 const existing=cache.get(query.toLowerCase());if(existing && existing.until>Date.now())return existing.result;
 if(Date.now()-searchWindow.starts>900000)searchWindow={starts:Date.now(),count:0};
 if(searchWindow.count>=20)throw new AgentError('RATE_LIMIT','Demo search limit reached; wait 15 minutes.',429);
 if(pending>=2)throw new AgentError('RATE_LIMIT','Searches are in progress; try again in a few seconds.',429);
 searchWindow.count++; pending++;
 try{
  const responses=await Promise.allSettled([searchTavily(query+' price supplier Mexico MXN'),discoverQuery(query)]);
  const sources=responses[0].status==='fulfilled'?responses[0].value:[];
  const candidates=responses[1].status==='fulfilled'?responses[1].value:[];
  const errors=responses.flatMap(r=>r.status==='rejected'?[r.reason instanceof AgentError?r.reason.code:'UPSTREAM_FAILED']:[]);
  const proof={candidates,expires:Date.now()+900000};
  const result={query,sources,candidates,errors,proof,signature:sign(proof),checkoutReady:!!process.env.DATABASE_URL && !!process.env.CAREPILOT_APP_ORIGIN};
  if(cache.size>=20)cache.delete(cache.keys().next().value!);
  cache.set(query.toLowerCase(),{until:Date.now()+60000,result});
  return result;
 }finally{pending--;}
}
