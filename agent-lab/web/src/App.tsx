import { useEffect, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Bot, Database, MessageSquare } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore, setUi } from '@/state/store'
import { cn } from '@/lib/utils'
import { useLang, useT } from '@/i18n'
import { ActivationScreen } from '@/features/ActivationScreen'
import { Header } from '@/features/Header'
import { SystemsPanel } from '@/features/systems/SystemsPanel'
import { RecordDialogHost } from '@/features/systems/RecordDialog'
import { WorkspacePanel } from '@/features/workspace/WorkspacePanel'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { Alert } from '@/features/common'

/** Three resizable panels from this width; below it the app shows one panel at a time with tabs. */
const DESKTOP_QUERY = '(min-width: 1100px)'

function useIsDesktop() {
  const [desk, setDesk] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const fn = () => setDesk(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return desk
}

const Handle = () => <Separator className="w-px bg-border transition-colors data-[separator=hover]:bg-foreground data-[separator=active]:bg-foreground" />

export default function App() {
  const status = useStore((s) => s.auth.status)
  const storage = useStore((s) => s.storage)
  const mobileTab = useStore((s) => s.ui.mobileTab)
  const desktop = useIsDesktop()
  const lang = useLang()
  const tx = useT().shell

  // index.html ships lang="pl"; keep the attribute in step with a stored or switched language.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const systems = <SystemsPanel />
  const workspace = <WorkspacePanel />
  const chat = <ChatPanel />

  return (
    <TooltipProvider>
      {status === 'locked' ? (
        <ActivationScreen />
      ) : (
        <div className="flex h-full flex-col">
          <Header />
          {storage === 'unavailable' && (
            <div role="alert" className="shrink-0 border-b bg-card px-3 py-2" data-testid="storage-unavailable">
              <Alert tone="danger" title={tx.storage.unavailable}>{tx.storage.hint}</Alert>
            </div>
          )}
          {desktop ? (
            <Group orientation="horizontal" className="min-h-0 flex-1">
              <Panel defaultSize="30" minSize="320px" maxSize="50" className="bg-card">{systems}</Panel>
              <Handle />
              <Panel defaultSize="41" minSize="360px">{workspace}</Panel>
              <Handle />
              <Panel defaultSize="29" minSize="320px" maxSize="42" className="bg-card">{chat}</Panel>
            </Group>
          ) : (
            <>
              <main className="min-h-0 flex-1 bg-card">
                <div className={cn('h-full', mobileTab !== 'chat' && 'hidden')}>{chat}</div>
                <div className={cn('h-full bg-background', mobileTab !== 'workspace' && 'hidden')}>{workspace}</div>
                <div className={cn('h-full', mobileTab !== 'systems' && 'hidden')}>{systems}</div>
              </main>
              <nav className="grid shrink-0 grid-cols-3 gap-1 border-t bg-card px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5" aria-label={tx.app.sections}>
                {([
                  ['chat', tx.app.tabChat, <MessageSquare key="c" />],
                  ['workspace', tx.app.tabWorkspace, <Bot key="w" />],
                  ['systems', tx.app.tabSystems, <Database key="s" />],
                ] as const).map(([id, label, icon]) => (
                  <button key={id} onClick={() => setUi({ mobileTab: id })} className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11.5px] transition-colors cursor-pointer [&_svg]:size-5', mobileTab === id ? 'bg-primary font-semibold text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted')} aria-current={mobileTab === id} data-tab={id}>
                    {icon}
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}
          <RecordDialogHost />
        </div>
      )}
    </TooltipProvider>
  )
}
