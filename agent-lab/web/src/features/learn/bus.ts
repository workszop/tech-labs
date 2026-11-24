/**
 * Store-independent channel of the learning layer: which topic the Learn
 * dialog shows, and "show me" requests that point at something in the app
 * (a panel, the tool switches, a scenario, a systems group). Panels that can
 * act on a request subscribe with `useShowHandler`; the request then
 * highlights the target element for a moment.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { setUi, type MobileTab } from '@/state/store'
import type { GroupId } from '@/features/systems/model'
import type { TopicId } from './topics'

export type ShowTarget =
  | { kind: 'panel'; panel: MobileTab }
  | { kind: 'tools' }
  | { kind: 'scenario'; id: string }
  | { kind: 'systems'; group: GroupId }

// ---------------------------------------------------------------- Learn dialog

interface LearnState {
  open: boolean
  topic: TopicId
  /** Opened without a topic (the header button): phones start on the topic list. */
  list: boolean
}
let learnState: LearnState = { open: false, topic: 'agent', list: true }
const learnListeners = new Set<() => void>()

function setLearn(patch: Partial<LearnState>) {
  learnState = { ...learnState, ...patch }
  learnListeners.forEach((l) => l())
}

/** Opens the Learn dialog, on a topic when given. */
export function openLearn(topic?: TopicId) {
  setLearn({ open: true, list: !topic, ...(topic ? { topic } : {}) })
}
export function closeLearn() {
  setLearn({ open: false })
}
export function setLearnTopic(topic: TopicId) {
  setLearn({ topic })
}
export function useLearnState(): LearnState {
  return useSyncExternalStore(
    (l) => {
      learnListeners.add(l)
      return () => learnListeners.delete(l)
    },
    () => learnState,
  )
}

// ---------------------------------------------------------------- show me

type Handler = (t: ShowTarget) => void
const handlers = new Set<Handler>()

/** The panel a target lives in (the tab shown on narrow screens). */
export function panelOf(t: ShowTarget): MobileTab {
  if (t.kind === 'panel') return t.panel
  if (t.kind === 'tools') return 'workspace'
  if (t.kind === 'scenario') return 'chat'
  return 'systems'
}

/** The element that is highlighted for a target. */
function spotOf(t: ShowTarget): string {
  if (t.kind === 'tools') return '[data-learn-spot="tools"]'
  return `[data-panel="${panelOf(t)}"]`
}

/** Points at a target: shows its panel, lets the panel act on it, then highlights it for about two seconds. */
export function showTarget(t: ShowTarget) {
  setUi({ mobileTab: panelOf(t) })
  handlers.forEach((h) => h(t))
  // Two frames: the panel's own state change (tab, group, open strip) renders first.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(spotOf(t))
      if (!el) return
      el.classList.remove('rl-spotlight')
      void el.offsetWidth
      el.classList.add('rl-spotlight')
      window.setTimeout(() => el.classList.remove('rl-spotlight'), 2200)
      // A scenario focuses the chat composer itself; other targets take the focus here.
      if (t.kind !== 'scenario') {
        if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1')
        el.focus({ preventScroll: true })
      }
    }),
  )
}

/** Subscribes a panel to "show me" requests. */
export function useShowHandler(handler: Handler) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const h: Handler = (t) => ref.current(t)
    handlers.add(h)
    return () => {
      handlers.delete(h)
    }
  }, [])
}
