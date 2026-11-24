/**
 * Per-run counters of POST /api/agent (`agent_runs`). A run is one customer
 * message and every model turn that answers it; it belongs to the session that
 * started it. Steps are reserved atomically, so parallel requests for the same
 * run cannot exceed the step or token limit.
 */
import { ApiError } from './http'

export interface AgentRunRow {
  run_id: string
  session_id: string
  steps: number
  tool_calls: number
  tokens: number
  created_at: number
}

export interface RunLimits {
  maxSteps: number
  maxToolCalls: number
  maxRunTokens: number
}

/**
 * Creates the run on first use, then reserves the next step. Returns the row
 * after the increment (`steps` is the 1-based number of this step).
 * Throws `invalid_request` for a run of another session and
 * `run_limit_exceeded` when the run already used its steps or tokens.
 */
export async function reserveRunStep(
  db: D1Database,
  runId: string,
  sessionId: string,
  limits: RunLimits,
  now: number,
): Promise<AgentRunRow> {
  const [, upd] = await db.batch<AgentRunRow>([
    db
      .prepare('INSERT INTO agent_runs (run_id, session_id, steps, tool_calls, tokens, created_at) VALUES (?1, ?2, 0, 0, 0, ?3) ON CONFLICT (run_id) DO NOTHING')
      .bind(runId, sessionId, now),
    db
      .prepare(
        `UPDATE agent_runs SET steps = steps + 1
          WHERE run_id = ?1 AND session_id = ?2 AND steps < ?3 AND tokens < ?4
        RETURNING *`,
      )
      .bind(runId, sessionId, limits.maxSteps, limits.maxRunTokens),
  ])
  const row = upd?.results?.[0] as AgentRunRow | undefined
  if (row) return row

  const current = await db.prepare('SELECT * FROM agent_runs WHERE run_id = ?1').bind(runId).first<AgentRunRow>()
  if (!current || current.session_id !== sessionId) {
    throw new ApiError('invalid_request', '`runId` belongs to another session. Start a new run with a new runId.')
  }
  throw new ApiError(
    'run_limit_exceeded',
    current.steps >= limits.maxSteps
      ? `This agent run already used all ${limits.maxSteps} model steps.`
      : `This agent run already used its budget of ${limits.maxRunTokens} tokens.`,
  )
}

/** Gives back a reserved step whose model call did not happen or failed. */
export async function releaseRunStep(db: D1Database, runId: string): Promise<void> {
  await db.prepare('UPDATE agent_runs SET steps = MAX(steps - 1, 0) WHERE run_id = ?1').bind(runId).run()
}

/** Adds the tool calls handed to the browser and the tokens of this step. */
export async function recordRunStep(db: D1Database, runId: string, toolCalls: number, tokens: number): Promise<AgentRunRow> {
  const row = await db
    .prepare('UPDATE agent_runs SET tool_calls = tool_calls + ?2, tokens = tokens + ?3 WHERE run_id = ?1 RETURNING *')
    .bind(runId, toolCalls, tokens)
    .first<AgentRunRow>()
  if (!row) throw new ApiError('internal', 'The agent run disappeared.')
  return row
}
