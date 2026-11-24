/**
 * Per-run counters of POST /api/agent (`agent_runs`). A run is one customer
 * message and every model turn that answers it; it belongs to the session that
 * started it. A step and its token estimate are reserved atomically, so parallel
 * requests for the same run cannot exceed the step limit, and the token budget
 * can be exceeded by at most one model turn: the turn whose estimate crosses the
 * budget is still served, without tools (a forced final answer), and the run is
 * refused (`run_limit_exceeded`) only once its tokens reach the budget.
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
 * Creates the run on first use, then reserves the next step and `estimate`
 * tokens. Returns the row after the increment (`steps` is the 1-based number of
 * this step, `tokens` includes this step's reservation) and `overBudget`, true
 * when this step's estimate crosses the run's token budget, so the step must be
 * a forced final turn.
 * Throws `invalid_request` for a run of another session and
 * `run_limit_exceeded` when the run already used its steps or its token budget.
 */
export async function reserveRunStep(
  db: D1Database,
  runId: string,
  sessionId: string,
  limits: RunLimits,
  estimate: number,
  now: number,
): Promise<AgentRunRow & { overBudget: boolean }> {
  const [, upd] = await db.batch<AgentRunRow>([
    db
      .prepare('INSERT INTO agent_runs (run_id, session_id, steps, tool_calls, tokens, created_at) VALUES (?1, ?2, 0, 0, 0, ?3) ON CONFLICT (run_id) DO NOTHING')
      .bind(runId, sessionId, now),
    db
      .prepare(
        `UPDATE agent_runs SET steps = steps + 1, tokens = tokens + ?5
          WHERE run_id = ?1 AND session_id = ?2 AND steps < ?3 AND tokens < ?4
        RETURNING *`,
      )
      .bind(runId, sessionId, limits.maxSteps, limits.maxRunTokens, estimate),
  ])
  const row = upd?.results?.[0] as AgentRunRow | undefined
  if (row) return { ...row, overBudget: row.tokens > limits.maxRunTokens }

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

/**
 * Gives back a reserved step (and its token estimate) whose model call did not
 * happen or failed. A run left without steps is removed, so refused requests
 * leave no rows behind.
 */
export async function releaseRunStep(db: D1Database, runId: string, estimate: number): Promise<void> {
  await db.batch([
    db.prepare('UPDATE agent_runs SET steps = MAX(steps - 1, 0), tokens = MAX(tokens - ?2, 0) WHERE run_id = ?1').bind(runId, estimate),
    db.prepare('DELETE FROM agent_runs WHERE run_id = ?1 AND steps = 0').bind(runId),
  ])
}

/** Adds the tool calls handed to the browser and replaces this step's token estimate with its real usage. */
export async function recordRunStep(db: D1Database, runId: string, toolCalls: number, tokens: number, estimate: number): Promise<AgentRunRow> {
  const row = await db
    .prepare('UPDATE agent_runs SET tool_calls = tool_calls + ?2, tokens = MAX(tokens + ?3 - ?4, 0) WHERE run_id = ?1 RETURNING *')
    .bind(runId, toolCalls, tokens, estimate)
    .first<AgentRunRow>()
  if (!row) throw new ApiError('internal', 'The agent run disappeared.')
  return row
}
