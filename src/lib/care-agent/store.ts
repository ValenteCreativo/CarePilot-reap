import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { AgentError, type Run } from './types';
function connection() {
  if (!process.env.DATABASE_URL) throw new AgentError('DATABASE_CONFIG_MISSING', 'Configura DATABASE_URL y aplica la migración del agente.', 503);
  return neon(process.env.DATABASE_URL);
}
export interface AgentStore {
  create(run: Run): Promise<void>;
  read(id: string, ownerId: string): Promise<Run>;
  withRun<T>(id: string, ownerId: string, fn: (run: Run, save: () => Promise<void>) => Promise<T>): Promise<T>;
}
export type TaggedQuery = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;
export function createAgentStore(query?: TaggedQuery): AgentStore {
  const connect = () => query ?? connection();
  return {
  async create(run) {
    await connect()`INSERT INTO care_agent_runs (id,owner_id,state) VALUES (${run.id},${run.ownerId},${JSON.stringify(run)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  },
  async read(id, ownerId) {
    const rows = await connect()`SELECT state FROM care_agent_runs WHERE id=${id}::uuid AND owner_id=${ownerId}::uuid`;
    if (!rows[0]) throw new AgentError('RUN_NOT_FOUND', 'No se encontró un acuerdo de tu cuenta.', 404);
    return rows[0].state as Run;
  },
  async withRun(id, ownerId, fn) {
    const sql = connect();
    const lock = randomUUID();
    const rows = await sql`UPDATE care_agent_runs SET lock_token=${lock}::uuid, locked_at=now() WHERE id=${id}::uuid AND owner_id=${ownerId}::uuid AND lock_token IS NULL RETURNING state`;
    if (!rows[0]) throw new AgentError('RUN_LOCKED_OR_NOT_FOUND', 'La operación está en curso o no pertenece a tu cuenta. Consulta su estado.', 409);
    const run = rows[0].state as Run;
    const save = async () => {
      const updated = await sql`UPDATE care_agent_runs SET state=${JSON.stringify(run)}::jsonb, updated_at=now() WHERE id=${id}::uuid AND owner_id=${ownerId}::uuid AND lock_token=${lock}::uuid RETURNING id`;
      if (!updated.length) throw new AgentError('LOCK_LOST', 'Se perdió la reserva de la operación; requiere revisión.', 409);
    };
    try { return await fn(run, save); }
    finally { await sql`UPDATE care_agent_runs SET lock_token=NULL, locked_at=NULL WHERE id=${id}::uuid AND lock_token=${lock}::uuid`; }
  },
  };
}
export const store = createAgentStore();
