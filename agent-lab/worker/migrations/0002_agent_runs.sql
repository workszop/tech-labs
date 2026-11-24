-- Service Agent Lab Worker - agent runs.
-- One row per agent run (one customer message and the model turns that answer it).
-- Only counters are stored: no message, tool argument or tool result text.

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id     TEXT PRIMARY KEY,                       -- uuid chosen by the browser
  session_id TEXT NOT NULL,                          -- owner; another session cannot continue the run
  steps      INTEGER NOT NULL DEFAULT 0,             -- model turns started
  tool_calls INTEGER NOT NULL DEFAULT 0,             -- validated tool calls handed to the browser
  tokens     INTEGER NOT NULL DEFAULT 0,             -- input + output tokens of all turns
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs (created_at);

-- usage_events.operation gains 'agent' ('chat' stays valid for old rows). SQLite cannot
-- change a CHECK constraint in place, so the table is rebuilt with its rows.
DROP TABLE IF EXISTS usage_events_new;
CREATE TABLE usage_events_new (
  id             TEXT PRIMARY KEY,
  access_code_id TEXT NOT NULL,
  session_id     TEXT,
  model          TEXT NOT NULL,
  operation      TEXT NOT NULL CHECK (operation IN ('embeddings', 'chat', 'agent')),
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL    NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL,                   -- ok | error | aborted
  created_at     INTEGER NOT NULL
);
INSERT INTO usage_events_new SELECT id, access_code_id, session_id, model, operation, input_tokens, output_tokens, estimated_cost, status, created_at FROM usage_events;
DROP TABLE usage_events;
ALTER TABLE usage_events_new RENAME TO usage_events;
CREATE INDEX IF NOT EXISTS idx_usage_events_code ON usage_events (access_code_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events (created_at);
