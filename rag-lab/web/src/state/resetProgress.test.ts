import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, getState, resetProgressState, setSettings, setState, setUi, updateUserTesting } from './store'

describe('resetProgressState', () => {
  it('clears guide, user testing, chat, selection and settings but keeps language and access', () => {
    setSettings({ lang: 'en', chunkSize: 200, labelSection: true })
    setState({ selection: ['proces-04'], activeRunId: 'r1', chat: [{ id: 'c1', role: 'user', runId: 'r1' }], auth: { status: 'active', session: null, notice: null } })
    setUi({ guideDone: ['sources', 'usertest'], logExported: true, centerTab: 'map' })
    updateUserTesting((u) => ({ ...u, round: 3, thumbs: { 's-draft': 'up' } }))

    resetProgressState()

    const s = getState()
    expect(s.settings).toEqual({ ...DEFAULT_SETTINGS, lang: 'en' })
    expect(s.selection).toEqual([])
    expect(s.chat).toEqual([])
    expect(s.runs).toEqual({})
    expect(s.activeRunId).toBeNull()
    expect(s.ui.guideDone).toEqual([])
    expect(s.ui.logExported).toBe(false)
    expect(s.ui.centerTab).toBe('guide')
    expect(s.ui.userTesting).toEqual({ round: 1, thumbs: {}, tags: {} })
    expect(s.auth.status).toBe('active')
  })
})
