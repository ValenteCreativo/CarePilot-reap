import { createHash } from 'node:crypto';
import type { CareInput, CareProposalResult, Proposal } from './types';

// Pure proposal generation: no clinical advice, writes, external calls or payments.
// Stable IDs let consumers deduplicate repeated events before confirming a plan.
export function proposeCare(input: CareInput): CareProposalResult {
  const eventId = createHash('sha256').update(JSON.stringify([input.familyId, input.source, input.externalEventId || input.text.trim(), input.actorId || ''])).digest('hex').slice(0, 24);
  const text = input.text.trim();
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const owner = /guille.*(?:agenda|encarga|puede)/.test(normalized) ? 'guille' : '';
  const payer = /yo (?:cubro|pago)|yo.*gastos/.test(normalized) ? input.actorId || '' : '';
  const budgetMatch = text.match(/(?:presupuesto[^$\d]{0,30}|\$)\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : null;
  const due = /semana/.test(normalized) ? 'Esta semana · confirmar fecha' : 'Fecha por confirmar';
  const proposals: Proposal[] = [];
  const add = (title: string, kind: Proposal['kind'], clinical: boolean, cap: number | null, evidence: string, inference: string) => proposals.push({ id: `${eventId}-${proposals.length}`, title, kind, owner, payer, budget: cap, due, clinical, evidence, inference });
  if (/estudio/.test(normalized)) {
    const countMatch = normalized.match(/(dos|tres|uno|un|\d+)\s+estudios?/);
    const count = countMatch ? ({ dos: 2, tres: 3, uno: 1, un: 1 }[countMatch[1]] || Number(countMatch[1])) : 1;
    for (let i = 0; i < Math.min(count, 10); i++) add(`Agendar estudio ${i + 1}`, 'study', true, null, 'Se mencionaron estudios; no se especificaron sus nombres ni precios.', 'Confirmar estudio, orden médica y fecha antes de agendar.');
  }
  if (/suministro|higiene|insumos/.test(normalized)) add('Organizar suministros de la semana', 'supplies', false, budget, budget !== null ? `Presupuesto indicado: $${budget} MXN. No es una cotización.` : 'Necesidad de suministros mencionada, sin precio verificado.', 'Confirmar lista de artículos y responsable. Compatibilidad con Reap pendiente.');
  if (/medicamento|dosis|pastilla/.test(normalized)) add('Revisar indicación de medicamento', 'medication', true, null, 'El mensaje menciona medicamentos; no se ha validado ninguna dosis.', 'Revisar receta con una persona. No se generan dosis ni horarios.');
  if (!proposals.length) add('Revisar y organizar la solicitud', 'task', false, budget, text, 'Solicitud libre: definir título, responsables y fecha en la revisión.');
  return { eventId, mode: 'rules', proposals, notes: ['Extracción por reglas locales; no se utilizó un modelo de IA.', 'El presupuesto se interpreta como MXN en esta demo: confirma moneda y montos.', 'Cada propuesta necesita revisión humana. Costos de estudios desconocidos.'] };
}
