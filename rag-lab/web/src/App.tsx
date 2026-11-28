import { useEffect, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { AlertTriangle, FlaskConical, FolderTree, MessageSquare, Monitor, X } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore, setUi } from '@/state/store'
import { cn } from '@/lib/utils'
import { useLang, useT } from '@/i18n'
import { ActivationScreen } from '@/features/ActivationScreen'
import { Header } from '@/features/Header'
import { FileExplorer } from '@/features/FileExplorer'
import { CenterPanel } from '@/features/CenterPanel'
import { OwnRag } from '@/features/own/OwnRag'
import { ChatPanel } from '@/features/ChatPanel'
import { DocumentDialog } from '@/features/DocumentDialog'
import { LearnDialog } from '@/features/LearnDialog'
import { SettingsDialog } from '@/features/SettingsDialog'
import { ChunkInspectDialog } from '@/features/ChunkInspectDialog'
import { Alert } from '@/features/common'

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
  const ready = useStore((s) => s.storage.ready)
  const storage = useStore((s) => s.storage)
  const mobileTab = useStore((s) => s.ui.mobileTab)
  const mode = useStore((s) => s.ui.mode)
  const desktop = useIsDesktop()
  const [narrowNoticeOpen, setNarrowNoticeOpen] = useState(true)
  const lang = useLang()
  const tx = useT().shell.app

  // index.html ships lang="pl"; keep the attribute in step with a stored or switched language.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  if (!ready) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{tx.opening}</div>

  return (
    <TooltipProvider>
      {status === 'locked' ? (
        <ActivationScreen />
      ) : (
        <div className="flex h-full flex-col">
          <Header />
          {storage.error && <Alert tone="danger" className="m-2">{tx.storageError(storage.error)}</Alert>}
          {!storage.persistent && !storage.error && (
            <div className="edu-block flex items-start gap-2 bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground" role="status">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{tx.notPersistent}</span>
            </div>
          )}
          {mode === 'own' ? (
            <main className="min-h-0 flex-1"><OwnRag /></main>
          ) : desktop ? (
            <Group orientation="horizontal" className="min-h-0 flex-1">
              <Panel defaultSize="21" minSize="15" maxSize="32" className="bg-card"><FileExplorer /></Panel>
              <Handle />
              <Panel defaultSize="51" minSize="30"><CenterPanel /></Panel>
              <Handle />
              <Panel defaultSize="28" minSize="20" maxSize="42" className="bg-card"><ChatPanel /></Panel>
            </Group>
          ) : (
            <>
              {narrowNoticeOpen && (
                <div className="edu-block flex items-start gap-2 bg-doc px-4 py-2 text-[12.5px] text-white" role="note" data-testid="narrow-notice">
                  <Monitor className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{tx.narrowNotice}</span>
                  <button onClick={() => setNarrowNoticeOpen(false)} aria-label={tx.dismiss} className="cursor-pointer rounded-full p-0.5 text-white transition-colors hover:bg-foreground"><X className="size-4" /></button>
                </div>
              )}
              <main className="min-h-0 flex-1 bg-card">
                <div className={cn('h-full', mobileTab !== 'docs' && 'hidden')}><FileExplorer /></div>
                <div className={cn('h-full bg-background', mobileTab !== 'lab' && 'hidden')}><CenterPanel /></div>
                <div className={cn('h-full', mobileTab !== 'chat' && 'hidden')}><ChatPanel /></div>
              </main>
              <nav className="grid shrink-0 grid-cols-3 gap-1 border-t bg-card px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5" aria-label={tx.sections}>
                {([
                  ['docs', tx.tabDocs, <FolderTree key="d" />],
                  ['lab', tx.tabLab, <FlaskConical key="l" />],
                  ['chat', tx.tabChat, <MessageSquare key="c" />],
                ] as const).map(([id, label, icon]) => (
                  <button key={id} onClick={() => setUi({ mobileTab: id })} className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11.5px] transition-colors cursor-pointer [&_svg]:size-5', mobileTab === id ? 'bg-primary font-semibold text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted')} aria-current={mobileTab === id}>
                    {icon}
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}
          <DocumentDialog />
          <ChunkInspectDialog />
          <LearnDialog />
          <SettingsDialog />
        </div>
      )}
    </TooltipProvider>
  )
}
