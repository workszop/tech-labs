import { setUi } from '@/state/store'

type PanelId = 'docs' | 'chat'
const timers = new Map<Element, number>()

/**
 * Bring a side panel to the user's attention. On narrow screens this switches
 * the tab; on desktop the panel is already on screen, so switching alone would
 * look like a dead button: outline it briefly and move focus into it.
 */
export function revealPanel(id: PanelId) {
  setUi({ mobileTab: id })
  // Wait for the tab switch to render: a hidden panel cannot take focus.
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-panel="${id}"]`)
    if (!el) return
    window.clearTimeout(timers.get(el))
    el.classList.remove('rl-spotlight')
    void el.offsetWidth // restart the animation on repeated clicks
    el.classList.add('rl-spotlight')
    timers.set(el, window.setTimeout(() => el.classList.remove('rl-spotlight'), 1800))
    const target = el.querySelector<HTMLElement>(id === 'chat' ? 'textarea' : '[data-folder-toggle]')
    target?.focus({ preventScroll: true })
  })
}
