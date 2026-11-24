/**
 * The twelve explanation topics (spec R24), their groups and icons, the "show
 * me" target of each, and which topic each info tip links to. The texts live
 * in `i18n/{en,pl}/learn.ts`.
 */
import {
  BookOpenCheck, Bot, Cable, Contact, GitCompareArrows, ListRestart, Lock, Search, ShieldAlert, UserCheck, Wrench, Workflow, type LucideIcon,
} from 'lucide-react'
import type { Tone } from '../common'
import type { ShowTarget } from './bus'

export type TopicId = 'agent' | 'toolCalling' | 'choosingTools' | 'loop' | 'api' | 'crm' | 'rag' | 'kbUse' | 'hitl' | 'permissions' | 'mistakes' | 'compare'
export type TopicGroup = 'basics' | 'systems' | 'safety' | 'compare'

export interface TopicDef {
  id: TopicId
  group: TopicGroup
  icon: LucideIcon
  show?: ShowTarget
}

export const TOPICS: readonly TopicDef[] = [
  { id: 'agent', group: 'basics', icon: Bot, show: { kind: 'panel', panel: 'workspace' } },
  { id: 'toolCalling', group: 'basics', icon: Wrench, show: { kind: 'tools' } },
  { id: 'choosingTools', group: 'basics', icon: Workflow, show: { kind: 'tools' } },
  { id: 'loop', group: 'basics', icon: ListRestart, show: { kind: 'panel', panel: 'workspace' } },
  { id: 'api', group: 'systems', icon: Cable, show: { kind: 'panel', panel: 'systems' } },
  { id: 'crm', group: 'systems', icon: Contact, show: { kind: 'systems', group: 'crm' } },
  { id: 'rag', group: 'systems', icon: Search, show: { kind: 'systems', group: 'knowledge' } },
  { id: 'kbUse', group: 'systems', icon: BookOpenCheck, show: { kind: 'scenario', id: 'troubleshooting-s2' } },
  { id: 'hitl', group: 'safety', icon: UserCheck, show: { kind: 'scenario', id: 'paid-repair-ticket' } },
  { id: 'permissions', group: 'safety', icon: Lock, show: { kind: 'scenario', id: 'access-control' } },
  { id: 'mistakes', group: 'safety', icon: ShieldAlert, show: { kind: 'tools' } },
  { id: 'compare', group: 'compare', icon: GitCompareArrows },
]

export const TOPIC_IDS: readonly TopicId[] = TOPICS.map((t) => t.id)

/** One tone per group (edulab order: grape, blue, yellow, then ink). */
export const GROUP_TONE: Record<TopicGroup, Tone> = { basics: 'query', systems: 'doc', safety: 'warn', compare: 'ink' }

export type TipId = 'toolCall' | 'markers' | 'score' | 'steps' | 'identity' | 'tools'

export const TIP_TOPIC: Record<TipId, TopicId> = {
  toolCall: 'toolCalling',
  markers: 'hitl',
  score: 'rag',
  steps: 'loop',
  identity: 'permissions',
  tools: 'choosingTools',
}
