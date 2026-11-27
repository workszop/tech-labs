/** Navigation between the five parts of the app. */
import { BUILT_IN_CASES } from '@/data/benchmark'
import { scoreRun, type CaseKind } from '@/rag/benchmark'
import { getState, setState, setUi, type AppState, type Part } from './store'

export const PARTS: Part[] = ['case', 'data', 'vectors', 'generator', 'benchmark']

/**
 * Open a part and bring its container back to the top. Already in that part (an action such as a
 * split preview or a build calls goTo too), nothing scrolls: the user keeps their place.
 */
export function goTo(part: Part): void {
  if (getState().ui.part === part) return
  setUi({ part })
  scrollPartToTop()
}

function scrollPartToTop(): void {
  if (typeof document === 'undefined') return
  document.querySelector<HTMLElement>('[data-part-scroll]')?.scrollTo({ top: 0 })
}

/**
 * The header's guide button: the Case part from its top, where the guide is. Unlike goTo it scrolls
 * also when the user is already in that part (below 1024 px the guide sits above the chat).
 */
export function openGuide(): void {
  setUi({ part: 'case' })
  scrollPartToTop()
}

/** "Full details" of an answer: the Retrieval tab of the Case part (Tech face), showing that answer. */
export function showRunDetails(runId: string): void {
  setState({ activeRunId: runId })
  setUi({ part: 'case', caseTechTab: 'retrieval' })
  // Below 1024 px the details sit under the chat: bring them into view (nothing moves when they are next to it).
  if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="tab-retrieval"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/** The small count shown next to a part in the parts bar; `null` when there is nothing to count. */
export function partMark(part: Part, s: AppState): number | null {
  if (part === 'benchmark') {
    // The passed count of the latest run, 0 included; null before the first run.
    const run = s.bench.runs.at(-1)
    if (!run) return null
    const kinds = new Map<string, CaseKind>([...BUILT_IN_CASES[s.settings.lang], ...s.bench.customCases].map((c) => [c.id, c.kind]))
    return scoreRun(run.results, (id) => kinds.get(id) ?? 'ordinary', run.caseIds.length, run.totalActive).passed
  }
  let n: number | null
  switch (part) {
    case 'data':
      n = s.selection.length
      break
    case 'vectors':
      n = s.index.chunks.length
      break
    case 'case':
      n = s.chat.filter((e) => e.role === 'user').length
      break
    default:
      n = null
  }
  return n ? n : null
}
