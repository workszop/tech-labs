-- RAG Lab Worker — initial schema.
-- All timestamps are INTEGER milliseconds since the Unix epoch (UTC).
-- No prompt, question or document text is ever stored.

CREATE TABLE IF NOT EXISTS access_codes (
  id                 TEXT PRIMARY KEY,
  code_hash          TEXT NOT NULL UNIQUE,          -- HMAC-SHA256(CODE_PEPPER, normalized code), hex
  label              TEXT,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER,                        -- NULL = never
  revoked_at         INTEGER,
  request_limit      INTEGER NOT NULL CHECK (request_limit >= 0),
  token_limit        INTEGER NOT NULL CHECK (token_limit >= 0),
  max_sessions       INTEGER NOT NULL CHECK (max_sessions >= 1),
  requests_used      INTEGER NOT NULL DEFAULT 0,
  tokens_used        INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL    NOT NULL DEFAULT 0,
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'revoked')),
  last_used_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_access_codes_created ON access_codes (created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,                 -- SHA-256(bearer token), hex
  access_code_id   TEXT NOT NULL REFERENCES access_codes (id),
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  revoked_at       INTEGER,
  last_activity_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions (access_code_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS usage_events (
  id             TEXT PRIMARY KEY,
  access_code_id TEXT NOT NULL,
  session_id     TEXT,
  model          TEXT NOT NULL,
  operation      TEXT NOT NULL CHECK (operation IN ('embeddings', 'chat')),
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL    NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL,                   -- ok | error | aborted
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_events_code ON usage_events (access_code_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events (created_at);

-- Fixed-window counters (activation throttling, per-session rate limits).
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);
