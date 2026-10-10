import { z } from 'zod';

// Nebius Token Factory configuration.
export function getModelName(): string {
  return process.env.NEBIUS_MODEL?.trim() || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
}
export function getNebiusApiKey(): string {
  const key = process.env.nebius?.trim() || process.env.NEBIUS_API_KEY?.trim();
  if (!key) throw new Error('Configura nebius o NEBIUS_API_KEY en el servidor.');
  return key;
}

function parseModelJson(content: string): unknown {
  const raw = (content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || content).trim();
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Nebius no devolvió JSON válido.');
    return JSON.parse(raw.slice(start, end + 1));
  }
}

async function generateText(prompt: string, systemPrompt?: string, schema?: Record<string, unknown>, jsonOnly = false): Promise<{ content: string; latencyMs: number }> {
  const key = getNebiusApiKey();
  const base = (process.env.NEBIUS_BASE_URL?.trim() || 'https://api.tokenfactory.nebius.com/v1').replace(/\/$/, '');
  const start = Date.now();
  let format: Record<string, unknown> | undefined = schema ? { type: 'json_schema', json_schema: { name: 'carepilot_output', strict: true, schema } } : jsonOnly ? { type: 'json_object' } : undefined;
  let usedJsonFallback = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${base}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({ model: getModelName(), max_completion_tokens: 12_000, reasoning_effort: 'low', temperature: .15,
          ...(format ? { response_format: format } : {}),
          messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }] }),
      });
    } catch {
      if (attempt === 2) throw new Error('No fue posible conectar con Nebius.');
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (schema && !usedJsonFallback && [400, 422].includes(response.status)) {
      format = { type: 'json_object' }; usedJsonFallback = true; attempt--;
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt < 2) { await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt)); continue; }
    }
    if (!response.ok) throw new Error(`Nebius respondió con error (${response.status}).`);
    const body = await response.json();
    const choice = body.choices?.[0];
    if (choice?.message?.refusal) throw new Error('Nebius no pudo atender esta solicitud.');
    if (choice?.finish_reason === 'length') throw new Error('La respuesta de Nebius quedó incompleta.');
    const raw = choice?.message?.content ?? choice?.text;
    const content = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(part => part.text || '').join('') : '';
    if (!content.trim()) throw new Error('Nebius devolvió una respuesta vacía.');
    return { content, latencyMs: Date.now() - start };
  }
  throw new Error('Nebius agotó los reintentos.');
}

export const nebiusService = {
  generateText,
  async generateJson<T>(prompt: string, schema: z.ZodType<T>, systemPrompt?: string): Promise<T> {
    const result = await generateText(prompt, systemPrompt, z.toJSONSchema(schema));
    return schema.parse(parseModelJson(result.content));
  },
};
