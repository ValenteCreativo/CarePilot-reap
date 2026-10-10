import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpret } from '../src/lib/care-agent/llm';
import { nebiusService } from '../src/lib/nebius';
import type { Intent } from '../src/lib/care-agent/types';

test('Nebius purchasing intent preserves explicit payer, responsible and budget checks', async () => {
  const original = nebiusService.generateJson;
  const intent: Intent = { needs: ['soap'], responsible: 'Guille', payer: 'self', budget: { amount: 700, currency: 'MXN' }, tasks: ['Comprar jabón'], clarification: null };
  nebiusService.generateJson = (async () => intent) as typeof original;
  try {
    assert.deepEqual(await interpret('Guille compra jabón; yo pago con mi presupuesto de 700 MXN'), intent);
    await assert.rejects(interpret('Guille compra jabón'), /Confirma en tu instrucción/);
    await assert.rejects(interpret('Guille compra jabón; yo pago 500 MXN'), /Confirma en tu instrucción/);
    await assert.rejects(interpret('Vale compra jabón; yo pago 700 MXN'), /Confirma en tu instrucción/);
  } finally { nebiusService.generateJson = original; }
});
