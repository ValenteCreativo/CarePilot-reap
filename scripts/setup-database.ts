import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const sql = neon(url);
  const statements = (await readFile('database/initial.sql', 'utf8')).split(';').map(s => s.trim()).filter(Boolean);
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Current CarePilot schema is ready.');
}
main().catch(() => { console.error('Database setup failed; verify DATABASE_URL and permissions.'); process.exitCode = 1; });
