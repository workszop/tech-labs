// No fake-indexeddb here: this file runs the app as a browser that blocks IndexedDB.
import { describe, expect, it, vi } from 'vitest'
import type { SessionInfo } from '@shared/api-types'

const embed = vi.fn()
vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, api: { ...real.api, embed }, onAuthLost: () => () => undefined }
})

const { initApp, ensureKbIndex, sendMessage } = await import('./actions')
const { getState, setState } = await import('./store')

const SESSION = {
  sessionRef: 'abc', label: null, expiresAt: '2026-12-01T00:00:00Z', usage: null,
  capabilities: { provider: 'mock', embeddingModel: 'mock-embed', chatModel: 'mock-rule-based-agent', agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 80000, maxMessageChars: 1000 } },
} as unknown as SessionInfo

describe('IndexedDB unavailable (final fix finding 15)', () => {
  it('finishes loading, flags the storage as unavailable and starts no indexing', async () => {
    expect(typeof indexedDB).toBe('undefined')
    await initApp()
    expect(getState()).toMatchObject({ ready: true, storage: 'unavailable' })
    setState({ auth: { status: 'active', session: SESSION, notice: null } })
    await ensureKbIndex()
    expect(embed).not.toHaveBeenCalled()
    expect(getState().kbIndex.status).toBe('idle')
  })

  it('refuses to start a run with a clear, localized message instead of a raw storage error', async () => {
    setState({ settings: { lang: 'pl' } })
    const err = (await sendMessage('Gdzie jest moja paczka?').catch((e: unknown) => e)) as Error
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/przeglądark/)
    expect(getState().currentRun).toBeNull()
  })
})
