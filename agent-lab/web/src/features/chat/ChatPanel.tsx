import { MessageSquare } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPanel } from '../PlaceholderPanel'

/** Right panel: the customer chat styled as a support widget. Placeholder until Task 8 replaces this component. */
export function ChatPanel() {
  const tx = useT().shell.panels.chat
  return <PlaceholderPanel panel="chat" tone="stone" icon={<MessageSquare />} title={tx.title} text={tx.empty} />
}
