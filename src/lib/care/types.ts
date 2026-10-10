export type CareRole = 'coordinator' | 'owner' | 'payer' | 'member' | 'recipient';
export type CareMember = { id: string; name: string; roles: CareRole[] };
export type CareInput = { source: 'web' | 'omi' | 'whatsapp'; familyId: string; actorId?: string; text: string; externalEventId?: string; receivedAt: string };
export type Proposal = { id: string; title: string; kind: 'study' | 'supplies' | 'medication' | 'task'; owner: string; payer: string; budget: number | null; due: string; clinical: boolean; evidence: string; inference: string; };
export type Agreement = Proposal & { approval: 'pending' | 'approved'; completed: boolean; date: string; };
export type CareProposalResult = { eventId: string; mode: 'rules' | 'nebius'; proposals: Proposal[]; notes: string[] };
export const members: CareMember[] = [
  { id: 'vale', name: 'Vale', roles: ['coordinator', 'payer'] },
  { id: 'guille', name: 'Guille', roles: ['owner', 'member'] },
  { id: 'helper', name: 'Caregiver', roles: ['member'] },
  { id: 'mama', name: 'Mom', roles: ['recipient'] },
];
export const demoInstruction = 'The doctor ordered two studies for Mom. Guille will handle scheduling them. I cover the expenses. We also need supplies for the week, with a maximum budget of $700';
export const roleLabels: Record<CareRole, string> = { coordinator: 'Coordination', owner: 'Operational lead', payer: 'Funder', member: 'Family member', recipient: 'Person cared for' };
