import { z } from 'zod';
import { AgentError, type Intent, type ResearchSource } from './types';
import { publicHttps } from './security';
export const categoryQueries = { wipes: 'toallitas higiene cuidado precio proveedor Mexico MXN', gloves: 'guantes higiene desechables precio proveedor Mexico MXN', soap: 'jabon higiene neutro precio proveedor Mexico MXN' } as const;
export function researchQuery(intent: Intent): string { return intent.needs.map(c => categoryQueries[c]).join(' OR '); }
export function extractPrices(text: string) {
  const matches = [...text.matchAll(/(?:(MXN|USD|EUR)\s*\$?\s*(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})?)|\$\s*(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(MXN|USD|EUR)?)/gi)].slice(0, 4);
  return matches.map(m => ({ amount: m[2] ?? m[3], currency: (m[1] ?? m[4] ?? '').toUpperCase() || null, evidence: m[0] }));
}
export async function searchTavily(query: string): Promise<ResearchSource[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new AgentError('TAVILY_CONFIG_MISSING', 'Falta TAVILY_API_KEY en el servidor.', 503);
  let response: Response;
  try { response = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, topic: 'general', search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false, include_images: false, auto_parameters: false }), signal: AbortSignal.timeout(15_000), redirect: 'error', cache: 'no-store' }); }
  catch { throw new AgentError('TAVILY_NETWORK_ERROR', 'Tavily did not respond within the time limit.', 502); }
  if (!response.ok) throw new AgentError('TAVILY_HTTP_ERROR', `Tavily returned HTTP ${response.status}.`, 502);
  const parsed = z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), content: z.string() })) }).safeParse(await response.json());
  if (!parsed.success) throw new AgentError('TAVILY_RESPONSE_INVALID', 'Invalid Tavily response.', 502);
  const consultedAt = new Date().toISOString();
  return parsed.data.results.slice(0, 5).filter(r => publicHttps(r.url)).map(r => ({ title: r.title.slice(0, 200), url: r.url, excerpt: r.content.slice(0, 1800), consultedAt, prices: extractPrices(r.content) }));
}
