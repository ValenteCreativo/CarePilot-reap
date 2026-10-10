import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpret } from '../src/lib/care-agent/llm';
import { nebiusService } from '../src/lib/nebius';
import type { Intent } from '../src/lib/care-agent/types';

test('Nebius purchasing intent preserves explicit payer, responsible and budget checks', async () => {
  const original = nebiusService.generateJson;
  const intent: Intent = { needs: ['soap'], responsible: 'Guille', payer: 'self', budget: { amount: 700, currency: 'MXN' }, tasks: ['Buy soap'], clarification: null };
  nebiusService.generateJson = (async () => intent) as typeof original;
  try {
    assert.deepEqual(await interpret('Guille buys soap; I pay with my budget of 700 MXN'), intent);
    await assert.rejects(interpret('Guille buys soap'), /confirm the person responsible/);
    await assert.rejects(interpret('Guille buys soap; I pay 500 MXN'), /confirm the person responsible/);
    await assert.rejects(interpret('Vale buys soap; I pay 700 MXN'), /confirm the person responsible/);
  } finally { nebiusService.generateJson = original; }
});
