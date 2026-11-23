import type { RequestContext } from '../context'
import { MIN_ADMIN_TOKEN_LENGTH, MIN_PEPPER_LENGTH } from '../env'
import { json } from '../http'

/** GET /api/health — liveness + coarse readiness. Never returns secret values. */
export async function handleHealth(c: RequestContext): Promise<Response> {
  let db = 'ok'
  try {
    await c.env.DB.prepare('SELECT 1 AS ok FROM access_codes LIMIT 1').all()
  } catch {
    db = 'error'
  }
  const checks = {
    database: db === 'ok',
    codePepperConfigured: c.cfg.codePepper.length >= MIN_PEPPER_LENGTH,
    adminAuthConfigured: c.cfg.adminToken.length >= MIN_ADMIN_TOKEN_LENGTH || Boolean(c.cfg.accessTeamDomain && c.cfg.accessAud),
    providerConfigured: c.cfg.provider === 'mock' || c.cfg.providerApiKey.length > 0,
    modelsAllowed: c.cfg.allowedModels.has(c.cfg.embeddingModel) && c.cfg.allowedModels.has(c.cfg.chatModel),
  }
  const ok = Object.values(checks).every(Boolean)
  return json({
    status: ok ? 'ok' : 'degraded',
    service: 'rag-lab-worker',
    provider: c.cfg.provider,
    embeddingModel: c.cfg.embeddingModel,
    chatModel: c.cfg.chatModel,
    embeddingDimensions: c.cfg.embeddingDimensions,
    checks,
    time: new Date().toISOString(),
  })
}
