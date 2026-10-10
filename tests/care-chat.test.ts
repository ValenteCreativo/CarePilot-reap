import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatCare, chatRequestSchema, type CareChatResponse } from '../src/lib/care/chat';
import { nebiusService } from '../src/lib/nebius';
const input = { messages: [{ role: 'user' as const, content: 'Organiza una cita' }], context: { person: 'Mamá', actorId: 'vale', today: '2026-10-09', team: [{ id: 'vale', name: 'Vale' }], tasks: [] } };
const action = { type: 'create_task' as const, taskId: null, title: 'Cita de control', kind: 'study' as const, owner: 'vale', payer: '', date: '', due: 'Fecha por confirmar', budget: null, clinical: false, reason: 'Revisar fecha con el consultorio.' };
test('care chat validates members, existing tasks and clinical flags', async () => {
  const original = nebiusService.generateJson;
  let output: CareChatResponse = { reply: 'Preparé una propuesta.', actions: [action], shopping: null };
  nebiusService.generateJson = (async () => structuredClone(output)) as typeof original;
  try {
    const result = await chatCare(input);
    assert.equal(result.actions[0].clinical, true);
    assert.deepEqual(input.context.tasks, []);
    output = { reply: 'Propuesta', actions: [{ ...action, owner: 'unknown' }], shopping: null };
    await assert.rejects(chatCare(input), /Unknown team member/);
    output = { reply: 'Propuesta', actions: [{ ...action, type: 'update_task', taskId: 'missing' }], shopping: null };
    await assert.rejects(chatCare(input), /Unknown task/);
    output = { reply: 'Puedo ayudarte a organizar el cuidado.', actions: [], shopping: null };
    assert.equal((await chatCare(input)).actions.length, 0);
  } finally { nebiusService.generateJson = original; }
});
test('rejects oversized conversations and invalid dates at entry', () => {
  assert.equal(chatRequestSchema.safeParse({ ...input, messages: Array(17).fill(input.messages[0]) }).success, false);
  assert.equal(chatRequestSchema.safeParse({ ...input, context: { ...input.context, today: 'mañana' } }).success, false);
});

test('Cuak executes one research tool and attaches real tool data without inventing prices', async () => {
  const original=nebiusService.generateJson;
  nebiusService.generateJson=(async()=>({reply:'Voy a buscar.',actions:[],shopping:{mode:'research',query:'pañales para adulto'}})) as typeof original;
  let calls=0;
  try{
    const result=await chatCare(input,async query=>{
      calls++;assert.equal(query,'pañales para adulto');
      return {query,sources:[],candidates:[],errors:['REAP_NO_RESULTS'],proof:{candidates:[],expires:Date.now()+1000},signature:'test',checkoutReady:false};
    });
    assert.equal(calls,1);assert.equal(result.research?.candidates.length,0);assert.match(result.reply,/0 sources/);
    assert.equal(result.actions.length,0);
  }finally{nebiusService.generateJson=original;}
});
test('private search text is rejected before invoking search providers', async()=>{
 const original=nebiusService.generateJson;
 nebiusService.generateJson=(async()=>({reply:'Buscaré.',actions:[],shopping:{mode:'research',query:'mi mamá se llama Ana y padece diabetes'}})) as typeof original;
 try{
  const result=await chatCare(input,async()=>{assert.fail('Private query must never reach research');});
  assert.match(result.shoppingError||'',/omit names/);
  assert.equal(result.research,undefined);
 }finally{nebiusService.generateJson=original;}
});
