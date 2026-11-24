import type { Env } from './env'
import { loadConfig } from './env'

/**
 * Cron cleanup: deletes sessions that expired / were revoked more than
 * CLEANUP_RETENTION_DAYS ago, agent runs older than the same retention period,
 * and rate-limit windows older than 2 hours (the longest window in use is the
 * activation window, at most 1 day; we keep a margin of 1 day + 2 h to be safe
 * for custom windows).
 */
export async function runCleanup(
  env: Env,
  now = Date.now(),
): Promise<{ sessions: number; rateLimits: number; agentRuns: number }> {
  const cfg = loadConfig(env)
  const retentionCutoff = now - cfg.cleanupRetentionDays * 86_400_000
  const rlCutoff = now - Math.max(cfg.activationWindowSeconds * 1000, 3_600_000) - 2 * 3_600_000
  const [s, r, a] = await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at < ?1 OR (revoked_at IS NOT NULL AND revoked_at < ?1)',
    ).bind(retentionCutoff),
    env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(rlCutoff),
    env.DB.prepare('DELETE FROM agent_runs WHERE created_at < ?1').bind(retentionCutoff),
  ])
  const result = { sessions: s?.meta.changes ?? 0, rateLimits: r?.meta.changes ?? 0, agentRuns: a?.meta.changes ?? 0 }
  console.log(JSON.stringify({ level: 'info', component: 'cleanup', ...result }))
  return result
}
