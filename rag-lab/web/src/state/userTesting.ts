// Pure state logic of the "User testing" exercise: round 1 thumbs, round 2 structured tags,
// round 3 the reveal. Ratings are keyed by scenario id, so switching the language keeps them.
import { FEEDBACK_TAGS, type FeedbackTag, type Scenario } from '@/data/userTesting'

export type Thumb = 'up' | 'down'

export interface UserTestingState {
  round: 1 | 2 | 3
  thumbs: Record<string, Thumb>
  tags: Record<string, FeedbackTag[]>
}

export const INITIAL_USER_TESTING: UserTestingState = { round: 1, thumbs: {}, tags: {} }

/** Set a thumb; the same thumb clicked again clears it. */
export function toggleThumb(s: UserTestingState, id: string, t: Thumb): UserTestingState {
  const thumbs = { ...s.thumbs }
  if (thumbs[id] === t) delete thumbs[id]
  else thumbs[id] = t
  return { ...s, thumbs }
}

export function toggleTag(s: UserTestingState, id: string, tag: FeedbackTag): UserTestingState {
  const cur = s.tags[id] ?? []
  const next = cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]
  return { ...s, tags: { ...s.tags, [id]: next } }
}

/** Round 1 needs a thumb on every answer, round 2 at least one tag on every answer. */
export function canAdvance(s: UserTestingState, ids: string[]): boolean {
  if (s.round === 1) return ids.every((id) => !!s.thumbs[id])
  if (s.round === 2) return ids.every((id) => (s.tags[id]?.length ?? 0) > 0)
  return false
}

export function thumbsSummary(s: UserTestingState): { up: number; down: number } {
  const v = Object.values(s.thumbs)
  return { up: v.filter((t) => t === 'up').length, down: v.filter((t) => t === 'down').length }
}

export function tagCounts(s: UserTestingState): Record<FeedbackTag, number> {
  const c = Object.fromEntries(FEEDBACK_TAGS.map((t) => [t, 0])) as Record<FeedbackTag, number>
  for (const tags of Object.values(s.tags)) for (const t of tags) c[t]++
  return c
}

/** Did the tester name at least one of the problems the answer really has? */
export function tagHits(s: UserTestingState, scenario: Scenario): boolean {
  return (s.tags[scenario.id] ?? []).some((t) => scenario.expected.includes(t))
}

export function resetUserTesting(): UserTestingState {
  return { round: 1, thumbs: {}, tags: {} }
}
