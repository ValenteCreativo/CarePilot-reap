import { createHash } from 'node:crypto';
import type { CareInput, CareProposalResult, Proposal } from './types';

// Pure proposal generation: no clinical advice, writes, external calls or payments.
// Stable IDs let consumers deduplicate repeated events before confirming a plan.
export function proposeCare(input: CareInput): CareProposalResult {
  const eventId = createHash('sha256').update(JSON.stringify([input.familyId, input.source, input.externalEventId || input.text.trim(), input.actorId || ''])).digest('hex').slice(0, 24);
  const text = input.text.trim();
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const owner = /guille.*(?:agenda|encarga|puede|will|handle|schedul|take)/.test(normalized) ? 'guille' : '';
  const payer = /yo (?:cubro|pago)|yo.*gastos|i (?:cover|pay|will cover|will pay)|i.*expenses/.test(normalized) ? input.actorId || '' : '';
  const budgetMatch = text.match(/(?:presupuesto[^$\d]{0,30}|budget[^$\d]{0,30}|\$)\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : null;
  const due = /semana|week/.test(normalized) ? 'This week · confirm date' : 'Date to be confirmed';
  const proposals: Proposal[] = [];
  const add = (title: string, kind: Proposal['kind'], clinical: boolean, cap: number | null, evidence: string, inference: string) => proposals.push({ id: `${eventId}-${proposals.length}`, title, kind, owner, payer, budget: cap, due, clinical, evidence, inference });
  if (/estudio|study|studies|test/.test(normalized)) {
    const countMatch = normalized.match(/(dos|tres|uno|un|two|three|one|\d+)\s+(?:estudios?|studies|study|tests?)/);
    const count = countMatch ? ({ dos: 2, tres: 3, uno: 1, un: 1, two: 2, three: 3, one: 1 }[countMatch[1]] || Number(countMatch[1])) : 1;
    for (let i = 0; i < Math.min(count, 10); i++) add(`Schedule test ${i + 1}`, 'study', true, null, 'Tests were mentioned; their names and prices were not specified.', 'Confirm the test, the doctor\u2019s order and the date before scheduling.');
  }
  if (/suministro|higiene|insumos|supplies|hygiene|supply/.test(normalized)) add('Organize this week\u2019s supplies', 'supplies', false, budget, budget !== null ? `Stated budget: $${budget} MXN. It is not a quote.` : 'Supply need mentioned, with no verified price.', 'Confirm the list of items and the person responsible. Reap compatibility pending.');
  if (/medicamento|dosis|pastilla|medication|dose|pill/.test(normalized)) add('Review medication instruction', 'medication', true, null, 'The message mentions medications; no dose has been validated.', 'Review the prescription with a person. No doses or schedules are generated.');
  if (!proposals.length) add('Review and organize the request', 'task', false, budget, text, 'Free-form request: define title, people responsible and date during review.');
  return { eventId, mode: 'rules', proposals, notes: ['Extraction by local rules; no AI model was used.', 'The budget is interpreted as MXN in this demo: confirm currency and amounts.', 'Every proposal needs human review. Test costs unknown.'] };
}
