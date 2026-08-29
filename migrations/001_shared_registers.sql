CREATE TABLE IF NOT EXISTS marsbank_registers (
  resident_slug text PRIMARY KEY,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marsbank_transfer_requests (
  request_id text PRIMARY KEY,
  resident_slug text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marsbank_transfer_requests_created_at_idx
  ON marsbank_transfer_requests (created_at);
