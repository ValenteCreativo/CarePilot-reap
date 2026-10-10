CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text UNIQUE,
 password_hash text,
 name text,
 phone_number text UNIQUE,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS care_agent_runs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  state jsonb NOT NULL,
  lock_token uuid,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_agent_runs_owner_idx ON care_agent_runs(owner_id, created_at);
CREATE TABLE IF NOT EXISTS care_agent_login_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
