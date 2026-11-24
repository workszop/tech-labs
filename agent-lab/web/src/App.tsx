import { useEffect, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Bot, Database, MessageSquare } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore, setUi } from '@/state/store'
import { cn } from '@/lib/utils'
import { useLang, useT } from '@/i18n'
import { ActivationScreen } from '@/features/ActivationScreen'
import { Header } from '@/features/Header'
import { PlaceholderPanel } from '@/features/PlaceholderPanel'

function useIsDesktop() {
  const [desk, setDesk] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => setDesk(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return desk
}

const Handle = () => <Separator className="w-px bg-border transition-colors data-[separator=hover]:bg-foreground data-[separator=active]:bg-foreground" />

export default function App() {
  const status = useStore((s) => s.auth.status)
  const mobileTab = useStore((s) => s.ui.mobileTab)
  const desktop = useIsDesktop()
  const lang = useLang()
  const tx = useT().shell

  // index.html ships lang="pl"; keep the attribute in step with a stored or switched language.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const systems = <PlaceholderPanel panel="systems" tone="doc" icon={<Database />} title={tx.panels.systems.title} text={tx.panels.systems.empty} />
  const workspace = <PlaceholderPanel panel="workspace" tone="query" icon={<Bot />} title={tx.panels.workspace.title} text={tx.panels.workspace.empty} />
  const chat = <PlaceholderPanel panel="chat" tone="stone" icon={<MessageSquare />} title={tx.panels.chat.title} text={tx.panels.chat.empty} />

  return (
    <TooltipProvider>
      {status === 'locked' ? (
        <ActivationScreen />
      ) : (
        <div className="flex h-full flex-col">
          <Header />
          {desktop ? (
            <Group orientation="horizontal" className="min-h-0 flex-1">
              <Panel defaultSize="22" minSize="15" maxSize="34" className="bg-card">{systems}</Panel>
              <Handle />
              <Panel defaultSize="48" minSize="30">{workspace}</Panel>
              <Handle />
              <Panel defaultSize="30" minSize="20" maxSize="42" className="bg-card">{chat}</Panel>
            </Group>
          ) : (
            <>
              <main className="min-h-0 flex-1 bg-card">
                <div className={cn('h-full', mobileTab !== 'systems' && 'hidden')}>{systems}</div>
                <div className={cn('h-full bg-background', mobileTab !== 'workspace' && 'hidden')}>{workspace}</div>
                <div className={cn('h-full', mobileTab !== 'chat' && 'hidden')}>{chat}</div>
              </main>
              <nav className="grid shrink-0 grid-cols-3 gap-1 border-t bg-card px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5" aria-label={tx.app.sections}>
                {([
                  ['systems', tx.app.tabSystems, <Database key="s" />],
                  ['workspace', tx.app.tabWorkspace, <Bot key="w" />],
                  ['chat', tx.app.tabChat, <MessageSquare key="c" />],
                ] as const).map(([id, label, icon]) => (
                  <button key={id} onClick={() => setUi({ mobileTab: id })} className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11.5px] transition-colors cursor-pointer [&_svg]:size-5', mobileTab === id ? 'bg-primary font-semibold text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted')} aria-current={mobileTab === id}>
                    {icon}
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}
        </div>
      )}
    </TooltipProvider>
  )
}
