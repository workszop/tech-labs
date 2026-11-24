import { Bot } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPanel } from '../PlaceholderPanel'

/** Centre panel: the agent's execution graph, timeline and inspector. Placeholder until Task 9 replaces this component. */
export function WorkspacePanel() {
  const tx = useT().shell.panels.workspace
  return <PlaceholderPanel panel="workspace" tone="query" icon={<Bot />} title={tx.title} text={tx.empty} />
}
