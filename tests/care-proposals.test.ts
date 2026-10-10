import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeCare } from '../src/lib/care/propose';
import { demoInstruction, type CareInput } from '../src/lib/care/types';
const input: CareInput = { source: 'web', familyId: 'demo-family', actorId: 'vale', text: demoInstruction, receivedAt: '2026-10-10T00:00:00Z' };
test('demo produces two studies and a budget cap, never a medical price', () => {
 const result = proposeCare(input);
 assert.equal(result.proposals.length, 3);
 assert.equal(result.proposals.filter(p => p.kind === 'study').length, 2);
 assert.ok(result.proposals.filter(p => p.kind === 'study').every(p => p.clinical && p.budget === null && p.owner === 'guille' && p.payer === 'vale'));
 assert.equal(result.proposals.find(p => p.kind === 'supplies')?.budget, 700);
});
test('stable IDs allow replay deduplication without saving input events', () => {
 const first = proposeCare(input);
 assert.deepEqual(proposeCare({ ...input, receivedAt: '2026-10-11T00:00:00Z' }).proposals, first.proposals);
 assert.notEqual(proposeCare({ ...input, actorId: 'guille' }).eventId, first.eventId);
 assert.notEqual(proposeCare({ ...input, familyId: 'another-family' }).eventId, first.eventId);
});
test('medication mentions only propose human review, no generated doses', () => {
 const result = proposeCare({ ...input, text: 'Necesitamos revisar los medicamentos' });
 assert.equal(result.proposals[0].kind, 'medication');
 assert.equal(result.proposals[0].clinical, true);
 assert.equal(result.proposals[0].owner, '');
 assert.equal(result.proposals[0].payer, '');
 assert.equal(result.proposals[0].budget, null);
});
test('unrecognized instructions remain reviewable rather than becoming fabricated tasks', () => {
 const result = proposeCare({ ...input, text: 'Hay que organizar el transporte' });
 assert.equal(result.proposals[0].kind, 'task');
 assert.equal(result.proposals[0].owner, '');
 assert.equal(result.mode, 'rules');
});
test('thousands separators and explicit budget are preserved', () => {
 const result = proposeCare({ ...input, text: 'Suministros con presupuesto máximo de $1,700.50' });
 assert.equal(result.proposals[0].budget, 1700.5);
});
