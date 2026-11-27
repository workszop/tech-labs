/** Navigation between the five parts of the app. */
import { setState, setUi, type AppState, type Part } from './store'

export const PARTS: Part[] = ['case', 'data', 'vectors', 'generator', 'benchmark']

/** Open a part and bring its container back to the top. */
export function goTo(part: Part): void {
  setUi({ part })
  if (typeof document === 'undefined') return
  document.querySelector<HTMLElement>('[data-part-scroll]')?.scrollTo({ top: 0 })
}

/** "Full details" of an answer: the Retrieval tab of the Case part (Tech face), showing that answer. */
export function showRunDetails(runId: string): void {
  setState({ activeRunId: runId })
  setUi({ part: 'case', caseTechTab: 'retrieval' })
}

/** The small count shown next to a part in the parts bar; `null` when there is nothing to count. */
export function partMark(part: Part, s: AppState): number | null {
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
