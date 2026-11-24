/**
 * One-click tool choices of the tools panel. Each preset switches tools off to
 * make one lesson visible (e.g. without the warranty lookup the agent cannot
 * say whether a repair is covered).
 */
import { TOOLS, TOOL_NAMES, type SystemId, type ToolName } from '@shared/tools'
import { SYSTEM_IDS } from '@/features/workspace/trace'

export type PresetId = 'all' | 'noCrm' | 'noLogistics' | 'noWarranty' | 'noKnowledge' | 'readOnly' | 'kbOnly'

/** Systems whose tools a preset switches off (`readOnly` switches off every state-changing tool instead). */
const OFF_SYSTEMS: Record<Exclude<PresetId, 'all' | 'readOnly' | 'kbOnly'>, SystemId[]> = {
  noCrm: ['crm'],
  noLogistics: ['logistics'],
  noWarranty: ['warranty'],
  noKnowledge: ['knowledge'],
}

export const PRESET_IDS: readonly PresetId[] = ['all', 'noCrm', 'noLogistics', 'noWarranty', 'noKnowledge', 'readOnly', 'kbOnly']

/** The tools that stay on with a preset, in registry order. */
export function presetTools(id: PresetId): ToolName[] {
  if (id === 'all') return [...TOOL_NAMES]
  if (id === 'readOnly') return TOOLS.filter((t) => t.readOnly).map((t) => t.name)
  // Only the knowledge search: the agent then works like a RAG assistant.
  if (id === 'kbOnly') return ['search_service_knowledge']
  const off = OFF_SYSTEMS[id]
  return TOOLS.filter((t) => !off.includes(t.system)).map((t) => t.name)
}

/** The preset that gives exactly these tools, or null for a custom choice. */
export function presetOf(enabled: readonly ToolName[]): PresetId | null {
  const key = TOOL_NAMES.filter((n) => enabled.includes(n)).join(',')
  return PRESET_IDS.find((id) => presetTools(id).join(',') === key) ?? null
}

/** Tools that are off, in registry order. */
export function disabledTools(enabled: readonly string[]): ToolName[] {
  return TOOL_NAMES.filter((n) => !enabled.includes(n))
}

/** The tools of each system, in the order of the graph. */
export function toolsBySystem(): { system: SystemId; tools: (typeof TOOLS)[number][] }[] {
  return SYSTEM_IDS.map((system) => ({ system, tools: TOOLS.filter((t) => t.system === system) }))
}
