import type { Settings } from './store'

/** The Generator decision: answer with the documents, without them, or both side by side. */
export type AnswerMode = 'with' | 'without' | 'both'

/** One decision from the two stored flags. Comparing needs documents, so RAG off always means 'without'. */
export function answerMode(s: Pick<Settings, 'ragEnabled' | 'compareMode'>): AnswerMode {
  if (!s.ragEnabled) return 'without'
  return s.compareMode ? 'both' : 'with'
}

/** The two stored flags for one decision. */
export function answerModePatch(m: AnswerMode): Pick<Settings, 'ragEnabled' | 'compareMode'> {
  return { ragEnabled: m !== 'without', compareMode: m === 'both' }
}
